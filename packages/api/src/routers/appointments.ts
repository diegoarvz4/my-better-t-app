import { db } from "@my-better-t-app/db";
import { appointment as appointmentTable, availability as availabilityTable } from "@my-better-t-app/db/schema/app";
import { user } from "@my-better-t-app/db/schema/auth";
import { ORPCError } from "@orpc/server";
import { and, eq, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { dateFromParts, dayOfWeek, generateDaySlots, overlaps, SLOT_MINUTES } from "../lib/slots";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const doctorUser = alias(user, "doctor_user");
const patientUser = alias(user, "patient_user");

type BookedRange = { start: Date; end: Date };

/** Load a doctor's weekly availability + scheduled appointments, then return
 *  the open 30-min slots for a single date (future-only). */
async function openSlotsForDate(doctorId: string, date: string): Promise<{ start: Date; end: Date }[]> {
  const dow = dayOfWeek(date);
  const ranges = await db
    .select({ startTime: availabilityTable.startTime, endTime: availabilityTable.endTime })
    .from(availabilityTable)
    .where(and(eq(availabilityTable.doctorId, doctorId), eq(availabilityTable.dayOfWeek, dow)));

  if (ranges.length === 0) return [];

  const dayStart = dateFromParts(date, 0);
  const dayEnd = dateFromParts(date, 24 * 60);
  const booked: BookedRange[] = (
    await db
      .select({ startAt: appointmentTable.startAt, endAt: appointmentTable.endAt })
      .from(appointmentTable)
      .where(
        and(
          eq(appointmentTable.doctorId, doctorId),
          eq(appointmentTable.status, "scheduled"),
          gte(appointmentTable.startAt, dayStart),
          lt(appointmentTable.startAt, dayEnd),
        ),
      )
  ).map((row) => ({ start: row.startAt, end: row.endAt }));

  const now = new Date();
  return generateDaySlots(date, ranges).filter((slot) => {
    if (slot.start <= now) return false;
    return !booked.some((b) => overlaps(slot.start, slot.end, b.start, b.end));
  });
}

function toAppointment(row: {
  id: string;
  doctorId: string;
  patientId: string;
  doctorName: string;
  patientName: string;
  startAt: Date;
  endAt: Date;
  status: string;
  reason: string | null;
}) {
  return {
    id: row.id,
    doctorId: row.doctorId,
    patientId: row.patientId,
    doctorName: row.doctorName,
    patientName: row.patientName,
    start: row.startAt.toISOString(),
    end: row.endAt.toISOString(),
    status: row.status as "scheduled" | "cancelled",
    reason: row.reason,
  };
}

export const appointmentsRouter = {
  mine: protectedProcedure.handler(async ({ context }) => {
    const me = context.session.user;
    const whereClause =
      me.role === "doctor"
        ? eq(appointmentTable.doctorId, me.id)
        : eq(appointmentTable.patientId, me.id);

    const rows = await db
      .select({
        id: appointmentTable.id,
        doctorId: appointmentTable.doctorId,
        patientId: appointmentTable.patientId,
        doctorName: doctorUser.name,
        patientName: patientUser.name,
        startAt: appointmentTable.startAt,
        endAt: appointmentTable.endAt,
        status: appointmentTable.status,
        reason: appointmentTable.reason,
      })
      .from(appointmentTable)
      .innerJoin(doctorUser, eq(appointmentTable.doctorId, doctorUser.id))
      .innerJoin(patientUser, eq(appointmentTable.patientId, patientUser.id))
      .where(whereClause)
      .orderBy(appointmentTable.startAt);

    return rows.map(toAppointment);
  }),

  availableDays: protectedProcedure
    .input(z.object({ doctorId: z.string(), from: dateStr, to: dateStr }))
    .handler(async ({ input }) => {
      const result: string[] = [];
      const [fy, fm, fd] = input.from.split("-").map(Number);
      const [ty, tm, td] = input.to.split("-").map(Number);
      const cursor = new Date(fy, fm - 1, fd);
      const end = new Date(ty, tm - 1, td);
      let guard = 0;
      while (cursor <= end && guard < 366) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        const date = `${y}-${m}-${d}`;
        const slots = await openSlotsForDate(input.doctorId, date);
        if (slots.length > 0) result.push(date);
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }
      return result;
    }),

  slots: protectedProcedure
    .input(z.object({ doctorId: z.string(), date: dateStr }))
    .handler(async ({ input }) => {
      const slots = await openSlotsForDate(input.doctorId, input.date);
      return slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));
    }),

  create: protectedProcedure
    .input(z.object({ doctorId: z.string(), start: z.string().datetime(), reason: z.string().max(500).optional() }))
    .handler(async ({ input, context }) => {
      const me = context.session.user;
      if (me.role !== "patient") {
        throw new ORPCError("FORBIDDEN", { message: "Only patients can book appointments" });
      }

      const start = new Date(input.start);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, "0");
      const d = String(start.getDate()).padStart(2, "0");
      const date = `${y}-${m}-${d}`;

      const open = await openSlotsForDate(input.doctorId, date);
      const match = open.some((s) => s.start.getTime() === start.getTime());
      if (!match) {
        throw new ORPCError("CONFLICT", { message: "That slot is no longer available" });
      }

      const id = crypto.randomUUID();
      await db.insert(appointmentTable).values({
        id,
        doctorId: input.doctorId,
        patientId: me.id,
        startAt: start,
        endAt: end,
        status: "scheduled",
        reason: input.reason ?? null,
      });

      const [doctor] = await db.select({ name: user.name }).from(user).where(eq(user.id, input.doctorId));
      return toAppointment({
        id,
        doctorId: input.doctorId,
        patientId: me.id,
        doctorName: doctor?.name ?? "",
        patientName: me.name,
        startAt: start,
        endAt: end,
        status: "scheduled",
        reason: input.reason ?? null,
      });
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const me = context.session.user;
      const [existing] = await db
        .select()
        .from(appointmentTable)
        .where(eq(appointmentTable.id, input.id));

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Appointment not found" });
      }
      if (existing.doctorId !== me.id && existing.patientId !== me.id) {
        throw new ORPCError("FORBIDDEN", { message: "Not your appointment" });
      }

      await db
        .update(appointmentTable)
        .set({ status: "cancelled" })
        .where(eq(appointmentTable.id, input.id));

      return { ok: true } as const;
    }),
};
