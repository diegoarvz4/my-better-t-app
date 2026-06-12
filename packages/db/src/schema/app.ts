import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const availability = sqliteTable(
  "availability",
  {
    id: text("id").primaryKey(),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sun .. 6=Sat
    startTime: text("start_time").notNull(), // "HH:MM" 24h, clinic-local
    endTime: text("end_time").notNull(), // "HH:MM"
  },
  (table) => [index("availability_doctorId_idx").on(table.doctorId)],
);

export const appointment = sqliteTable(
  "appointment",
  {
    id: text("id").primaryKey(),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    patientId: text("patient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").default("scheduled").notNull(), // 'scheduled' | 'cancelled'
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("appointment_doctorId_idx").on(table.doctorId),
    index("appointment_patientId_idx").on(table.patientId),
  ],
);

export const availabilityRelations = relations(availability, ({ one }) => ({
  doctor: one(user, {
    fields: [availability.doctorId],
    references: [user.id],
  }),
}));

export const appointmentRelations = relations(appointment, ({ one }) => ({
  doctor: one(user, {
    fields: [appointment.doctorId],
    references: [user.id],
  }),
  patient: one(user, {
    fields: [appointment.patientId],
    references: [user.id],
  }),
}));
