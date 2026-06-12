import { db } from "@my-better-t-app/db";
import { availability as availabilityTable } from "@my-better-t-app/db/schema/app";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const slotInput = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const availabilityRouter = {
  mine: protectedProcedure.handler(async ({ context }) => {
    return db
      .select()
      .from(availabilityTable)
      .where(eq(availabilityTable.doctorId, context.session.user.id));
  }),

  set: protectedProcedure
    .input(z.object({ slots: z.array(slotInput) }))
    .handler(async ({ input, context }) => {
      if (context.session.user.role !== "doctor") {
        throw new ORPCError("FORBIDDEN", { message: "Only doctors can set availability" });
      }
      const doctorId = context.session.user.id;

      await db.delete(availabilityTable).where(eq(availabilityTable.doctorId, doctorId));

      if (input.slots.length > 0) {
        await db.insert(availabilityTable).values(
          input.slots.map((slot) => ({
            id: crypto.randomUUID(),
            doctorId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        );
      }

      return db.select().from(availabilityTable).where(eq(availabilityTable.doctorId, doctorId));
    }),
};
