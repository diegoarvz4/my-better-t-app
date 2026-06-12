# Spec: Doctor / Patient Appointments

## Goal

A medical appointment app on the existing Better-T-Stack (Next.js 16 + oRPC + Drizzle/libSQL + Better-Auth). Two roles share one email/password login:

- **Doctor** — logs in, sees a dashboard with a calendar; clicking a day shows that day's appointments with patients. Can publish weekly availability.
- **Patient** — logs in, sees a dashboard of their appointments with doctors; can browse a doctor index, pick a doctor, see the doctor's available days on a calendar, and book an appointment in an open slot.

This spec is the **stable contract** the parallel UI agents build against. Types and routes here are authoritative.

## Roles

`user.role: "doctor" | "patient"` (default `"patient"`), set at sign-up. Doctors also have an optional `specialty`. Role is a Better-Auth additional field, persisted on the `user` table and present on the session user.

Sign-up form gains a role selector; choosing "Doctor" reveals a specialty input.

After login, `/dashboard` branches on `session.user.role`.

## Data model (`packages/db/src/schema`)

Added to `user` (auth.ts): `role TEXT NOT NULL DEFAULT 'patient'`, `specialty TEXT`.

New tables (app.ts):

```
availability
  id         text pk
  doctorId   text -> user.id (cascade)
  dayOfWeek  integer   -- 0=Sun .. 6=Sat
  startTime  text      -- "HH:MM" 24h, local clinic time
  endTime    text      -- "HH:MM"

appointment
  id         text pk
  doctorId   text -> user.id (cascade)
  patientId  text -> user.id (cascade)
  startAt    integer timestamp_ms
  endAt      integer timestamp_ms
  status     text not null default 'scheduled'   -- 'scheduled' | 'cancelled'
  reason     text
  createdAt  integer timestamp_ms default now
```

Slot length is **30 minutes**. Availability is weekly-recurring; concrete slots are computed per requested date.

## API contract (oRPC, `packages/api/src/routers`)

All procedures are `protectedProcedure` unless noted. Shapes (TypeScript):

```ts
type Doctor = { id: string; name: string; email: string; specialty: string | null };
type Availability = { id: string; doctorId: string; dayOfWeek: number; startTime: string; endTime: string };
type Slot = { start: string; end: string }; // ISO strings
type Appointment = {
  id: string; doctorId: string; patientId: string;
  doctorName: string; patientName: string;
  start: string; end: string;            // ISO
  status: "scheduled" | "cancelled";
  reason: string | null;
};
```

Nested router on `appRouter`:

- `doctors.list()` → `Doctor[]` — all users with role `doctor`.
- `doctors.get({ id })` → `Doctor & { availability: Availability[] }`.
- `availability.mine()` → `Availability[]` — caller's own (doctor).
- `availability.set({ slots: { dayOfWeek; startTime; endTime }[] })` → `Availability[]` — replaces caller's availability (doctor only; 403 otherwise).
- `appointments.mine()` → `Appointment[]` — role-aware: doctor sees appts where they are the doctor, patient where they are the patient. Sorted by `start`.
- `appointments.availableDays({ doctorId, from, to })` → `string[]` (`YYYY-MM-DD`) — days in range that have ≥1 open slot.
- `appointments.slots({ doctorId, date })` → `Slot[]` — open 30-min slots for that day (availability minus booked, excludes past times).
- `appointments.create({ doctorId, start, reason? })` → `Appointment` — patient books; validates the slot is real and free (409 on conflict).
- `appointments.cancel({ id })` → `{ ok: true }` — either participant can cancel.

Existing `healthCheck` / `privateData` are retained.

## Frontend routes

- `/login` — existing; sign-up adds role + specialty.
- `/dashboard` — branches by role into the doctor or patient view.
- Doctor: dashboard calendar + day appointments panel; an availability editor (e.g. `/dashboard` section or `/availability`).
- Patient: dashboard appointment list; `/doctors` index; `/doctors/[id]` booking view with available-days calendar + slot picker.

Shared month-calendar lives at `apps/web/src/components/calendar/month-calendar.tsx` and is consumed by both sides. It renders a month grid, supports a `selected` date, an `onSelectDate` callback, month navigation, and an optional `markedDays: Set<YYYY-MM-DD>` to highlight days (e.g. days with appointments or availability).

## Out of scope (for now)

Email verification, reschedule, notifications, timezones beyond a single clinic-local time, recurring patient appointments, payments.
