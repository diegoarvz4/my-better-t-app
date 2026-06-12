# Testing Plan: Doctor / Patient Appointments

Companion to `specs/appointments.md`. This document describes **what** to test
and **how** to structure the suite. It contains no test code. All symbol and
procedure names below reference real code in `packages/api`.

---

## 1. Scope & Objectives

### In scope
- Pure slot-computation logic in `packages/api/src/lib/slots.ts`.
- All oRPC procedures under `packages/api/src/routers`:
  `doctorsRouter` (`doctors.list`, `doctors.get`),
  `availabilityRouter` (`availability.mine`, `availability.set`),
  `appointmentsRouter` (`appointments.mine`, `availableDays`, `slots`, `create`, `cancel`).
- End-to-end booking, cancellation, and double-booking flows through the
  Next.js web app (`http://localhost:3001`).

### Out of scope (per spec §"Out of scope")
Email verification, reschedule, notifications, multi-timezone, recurring patient
appointments, payments. The existing `healthCheck` / `privateData` procedures
are smoke-tested only.

### Objectives
1. Prove slot generation is correct and deterministic for all range shapes.
2. Prove role-based authorization is enforced at the procedure boundary.
3. Prove double-booking is impossible through the supported flow.
4. Prove role-aware data filtering (`appointments.mine`) returns only the
   caller's appointments from the correct side.
5. Prove auth flows (sign-up with role, protected-procedure rejection) work.

### Risk areas (prioritized)
| Risk | Where | Why it matters |
|---|---|---|
| **Slot computation correctness** | `generateDaySlots`, `parseHHMM`, partial trailing slot drop | A bug yields slots that don't exist or drops valid ones. |
| **Double-booking prevention** | `appointments.create` → `openSlotsForDate` | Two patients in the same slot is a clinical safety defect. There is **no DB unique constraint**; the guard is purely the `open.some(...)` check, so concurrent requests are a known TOCTOU risk (see §3/§4 notes). |
| **Role-based authorization** | `availability.set` (doctor-only), `appointments.create` (patient-only), `appointments.cancel` (participant-only) | Wrong role acting on data. |
| **Auth flows** | `protectedProcedure` / `requireAuth` middleware | Unauthenticated access must throw `UNAUTHORIZED`. |
| **Timezone / local-time assumption** | `dateFromParts`, `dayOfWeek`, `appointments.create` date derivation | Slots are built in **server local time**; tests run in a different TZ will flake. See §6. |

### Known correctness concerns to assert against (not just confirm current behavior)
- `doctors.get` filters by `user.id` only, **not** by `role === "doctor"`. A
  valid patient `id` will return a "doctor" object with `availability: []`
  instead of `NOT_FOUND`. The integration suite should include a test that
  documents/locks this (see §4, `doctors.get`).
- `appointments.create` has no transaction around the open-slot check and the
  insert; double-booking prevention is only proven for sequential requests.

---

## 2. Recommended Tooling & Rationale

> Recommendations only. **Do not add dependencies** as part of this plan; the
> stack currently has "no test runner and no lint task" (per `CLAUDE.md`).

| Layer | Tool | Rationale |
|---|---|---|
| Unit + integration | **Vitest** | Native ESM/TS, fast watch, fits a pnpm + Turborepo monorepo. The packages export raw `./src/*.ts` (no build step), which Vitest consumes directly. |
| Integration DB | **libSQL test database** (temp file or `:memory:`) | The app uses Drizzle + libSQL. A throwaway libSQL DB exercises the real SQL the routers emit (joins, `alias`, `gte/lt` range filters) without mocking Drizzle. |
| E2E | **Playwright** | Real browser drives the Next.js app on `:3001`, covering sign-up role selection, calendar UI, slot picker, and cross-dashboard reflection. |

### Integration DB strategy
- Build a test libSQL client pointing at an in-memory DB (`:memory:`) or a
  per-run temp file. Apply schema via `pnpm db:push` against the test DB, or by
  running the Drizzle schema definitions in `packages/db/src/schema`.
- **Reset between tests**: truncate/delete from `appointment`, `availability`,
  and seeded `user` rows in `beforeEach` (or recreate `:memory:` per file).
  Order matters due to `cascade` FKs: delete `appointment` and `availability`
  before `user`.
- The routers import a singleton `db` from `@my-better-t-app/db`. To point them
  at the test DB, either (a) set `DATABASE_URL` to the test DB before import, or
  (b) introduce a seam so `db` can be overridden in tests. Document this as a
  prerequisite; the plan assumes (a).
- Call procedures by invoking the router handlers with a hand-built `context`
  (`{ session: { user: { id, role, name, ... } } }`) so role and identity are
  controlled per test. Unauthenticated cases call through `protectedProcedure`
  with `session` absent to assert `UNAUTHORIZED`.

### E2E strategy
- Seed via the same DB helpers, then drive the UI. Reset the DB between specs.
- Use Playwright storage-state per role to avoid re-login on every test where
  the sign-up flow itself is not under test.

---

## 3. Unit Tests — `packages/api/src/lib/slots.ts`

Pure functions; no DB. Constant `SLOT_MINUTES = 30`.

### `parseHHMM`
- `"00:00"` → `0`.
- `"09:30"` → `570`.
- `"23:59"` → `1439`.
- `"24:00"` → `1440` (used by `dateFromParts(date, 24*60)` for day-end).

### `dateFromParts`
- `("2026-06-15", 0)` → local midnight of 2026-06-15 (`getHours() === 0`).
- `("2026-06-15", 570)` → 09:30 local (`getHours()===9`, `getMinutes()===30`).
- `("2026-06-15", 1440)` → rolls to 2026-06-16 00:00 local (overflow handled by `Date`).
- Asserts month is zero-indexed correctly (June → `getMonth() === 5`).

### `dayOfWeek`
- A known Sunday (e.g. `"2026-06-14"`) → `0`.
- A known Saturday (e.g. `"2026-06-13"`) → `6`.
- A known Monday → `1`. (Pick fixed dates so the test is deterministic.)

### `generateDaySlots`
- **Exact fit**: `[{"09:00","10:00"}]` → 2 slots: 09:00–09:30, 09:30–10:00.
- **Partial trailing slot dropped**: `[{"09:00","09:40"}]` → 1 slot
  (09:00–09:30); the 09:30–10:00 candidate exceeds `endTime` so the
  `t + SLOT_MINUTES <= end` guard drops it.
- **Sub-slot range**: `[{"09:00","09:20"}]` → 0 slots.
- **Empty ranges**: `[]` → `[]`.
- **Multiple ranges**: `[{"09:00","10:00"},{"13:00","13:30"}]` → 3 slots total.
- **Ordering**: pass ranges out of order `[{"13:00","13:30"},{"09:00","10:00"}]`
  and assert output is sorted ascending by `start` (verifies the trailing
  `.sort(...)`).
- **Slot Date correctness**: each slot's `end - start === 30 min`; `start`/`end`
  built from the right date.

### `overlaps` — `[aStart,aEnd)` vs `[bStart,bEnd)`
- **Identical ranges** → `true`.
- **Partial overlap** (a starts inside b) → `true`.
- **a fully inside b** → `true`.
- **Touching at boundary, a before b** (`aEnd === bStart`) → `false`
  (half-open intervals; this is the critical edge for back-to-back slots).
- **Touching at boundary, b before a** (`bEnd === aStart`) → `false`.
- **Fully disjoint** → `false`.

---

## 4. Integration Tests — oRPC Procedures

Each procedure: happy path + auth/role guards + edges. All are
`protectedProcedure`, so every procedure additionally gets an
**unauthenticated → `UNAUTHORIZED`** case (call with no `session.user`).

### `doctors.list`
- Happy: seeded doctor present; **patients excluded** (only `role === "doctor"`).
- Shape: returns `{ id, name, email, specialty }`; no extra fields.
- Empty: no doctors → `[]`.

### `doctors.get`
- Happy: valid doctor id → doctor fields + `availability: Availability[]`
  matching seeded rows.
- **`NOT_FOUND`**: random/unknown id → `ORPCError("NOT_FOUND")`.
- **Documented gap** (see §1): a *patient* id currently does **not** throw
  `NOT_FOUND` because `get` filters by `id` only, not `role`. Add a test that
  passes a patient id and asserts the desired behavior (`NOT_FOUND`). If current
  code returns a row, mark the test as the failing/expected-fix spec.

### `availability.mine`
- Happy: doctor with seeded availability → exactly their rows.
- Isolation: a second doctor's rows are not returned.
- Empty: doctor with none → `[]`.
- (Note: `mine` does not check role; a patient calling it simply gets `[]`
  since no availability rows reference their id. Assert this.)

### `availability.set`
- **Patient → `FORBIDDEN`** (`role !== "doctor"`).
- Happy: doctor sets `[{dayOfWeek, startTime, endTime}, ...]`; return value
  equals the new rows.
- **Replace semantics**: doctor with existing availability calls `set` with a
  new list → old rows deleted, only new rows remain (verify count + contents).
- **Clear**: `set({ slots: [] })` → all availability removed; returns `[]`.
- Validation: invalid `dayOfWeek` (e.g. `7`) or malformed time (`"9:00"`)
  rejected by Zod (`slotInput` regex `^\d{2}:\d{2}$`).

### `appointments.mine` (role-aware)
- **Doctor view**: returns appts where `doctorId === me.id` only.
- **Patient view**: returns appts where `patientId === me.id` only.
- **Cross-isolation**: appts belonging to another doctor/patient excluded.
- **Sorting**: returns ascending by `start` (`orderBy(startAt)`).
- **Joins/shape**: `doctorName` and `patientName` populated from the
  `doctorUser`/`patientUser` aliases; ISO `start`/`end` strings; `status`,
  `reason` present. Include a cancelled appointment to confirm it is still
  listed (mine does not filter by status).

### `appointments.availableDays`
- Happy: doctor available on a weekday in `[from, to]` → that `YYYY-MM-DD`
  appears; days with no availability omitted.
- **Booked-out day excluded**: if every slot on a day is booked, that day is
  omitted (delegates to `openSlotsForDate`).
- **Past excluded**: a day fully in the past returns no open slots → omitted.
- Range guard: assert the `guard < 366` cap doesn't truncate a normal month range.
- Edge: `from === to` single-day range.

### `appointments.slots`
- Happy: returns 30-min `{start,end}` ISO slots for an available day.
- **Excludes booked**: insert a scheduled appointment overlapping one slot →
  that slot absent, others present (verifies `overlaps` + `booked` filter).
- **Excludes past**: for *today*, slots with `start <= now` are dropped; future
  slots remain. (Use a controllable clock — see §6 — to avoid flakiness.)
- **Cancelled appts don't block**: a `status: "cancelled"` appointment in the
  slot → slot is still open (query filters `status === "scheduled"`).
- No availability that weekday → `[]`.

### `appointments.create`
- **Doctor → `FORBIDDEN`** (`role !== "patient"`).
- Happy: patient books a real open slot → returns `Appointment` with correct
  `doctorId`, `patientId`, ISO `start`/`end` (`end = start + 30min`),
  `status: "scheduled"`, `doctorName`, `patientName`, optional `reason`.
- **`CONFLICT` — slot already taken**: book the same slot twice (second call)
  → `ORPCError("CONFLICT")` ("no longer available").
- **`CONFLICT` — slot not within availability**: `start` that is not a
  generated slot (e.g. doctor unavailable that day, or a time not on a 30-min
  boundary inside a range) → `CONFLICT` (the `open.some(start===)` check fails).
- **`CONFLICT` — past slot**: `start` in the past → not in `openSlotsForDate`
  output → `CONFLICT`.
- Validation: non-datetime `start`, `reason` > 500 chars rejected by Zod.
- **TOCTOU note**: there is no transaction/unique constraint. Sequential
  double-book is covered above; document that true concurrent double-booking is
  *not* prevented by current code and recommend a DB-level guard as a fix. A
  concurrency stress test is optional and may be flaky.

### `appointments.cancel`
- **`NOT_FOUND`**: unknown id → `ORPCError("NOT_FOUND")`.
- Happy (patient): the booking patient cancels → `{ ok: true }`; row `status`
  becomes `"cancelled"`.
- Happy (doctor): the appointment's doctor cancels → `{ ok: true }`.
- **`FORBIDDEN` — non-participant**: a third user (other doctor/patient) → throws.
- Side effect: after cancel, the freed slot reappears in `appointments.slots`
  (cross-check with the slots test).

---

## 5. End-to-End Scenarios (Given / When / Then)

Driven via Playwright against `:3001`. DB reset + seed (or sign-up) per spec.

### E2E-1: Doctor onboarding & availability
- **Given** a fresh visitor on `/login`.
- **When** they sign up choosing role **Doctor** and entering a specialty,
  then open the availability editor and publish weekly availability.
- **Then** they land on the role-branched `/dashboard` doctor view (calendar +
  day panel), and `availability.mine` reflects the published rows.

### E2E-2: Patient books a slot
- **Given** a seeded doctor (with availability) and a freshly signed-up patient.
- **When** the patient visits `/doctors`, opens the doctor (`/doctors/[id]`),
  picks an available day on the calendar, and books an open slot.
- **Then** the booked slot **disappears** from the slot picker, the appointment
  appears on the patient dashboard list **and** on the doctor's day panel for
  that date.

### E2E-3: Cancellation reflects on both sides
- **Given** the booked appointment from E2E-2.
- **When** either participant cancels it.
- **Then** it shows as cancelled/removed on both dashboards, and the freed slot
  becomes bookable again in the patient's slot picker.

### E2E-4: Double-booking prevented
- **Given** two patient sessions and a single open slot.
- **When** patient A books the slot, then patient B attempts the same slot.
- **Then** patient B's booking fails (conflict surfaced as an error toast via
  the shared `QueryCache.onError`), and the slot shows booked exactly once.

### E2E-5: Auth gate
- **Given** an unauthenticated browser.
- **When** navigating to `/dashboard` or `/doctors`.
- **Then** access is denied / redirected to `/login` (protected procedures
  return `UNAUTHORIZED`).

---

## 6. Test Data / Fixtures

### Seed set (deterministic)
- **Doctor**: `id: "doc-1"`, `role: "doctor"`, `name: "Dr. Alice Smith"`,
  `email: "doctor@test.local"`, `specialty: "Cardiology"`.
  Availability: e.g. Monday (`dayOfWeek 1`) `09:00`–`12:00` (6 slots).
- **Patient**: `id: "pat-1"`, `role: "patient"`, `name: "Bob Jones"`,
  `email: "patient@test.local"`.
- Optional second doctor + second patient for isolation/forbidden tests.

### Deterministic dates
- Pin a reference date in the **future** relative to the test clock, on a
  weekday that matches seeded availability (e.g. a Monday).
- Inject a fixed "now" via fake timers (`vi.setSystemTime`) for any test that
  exercises the past-slot filter in `openSlotsForDate` (`slot.start <= now`).
  Without this, "excludes past" tests are time-of-day dependent and flaky.

### Timezone assumption & flakiness risk (call out explicitly)
- `dateFromParts` and `dayOfWeek` use the **local** `Date` constructor, and
  `appointments.create` derives the date string from `start.getFullYear()/
  getMonth()/getDate()` (local). Slots are therefore in **server local time**
  (single clinic-local zone per spec).
- **Risk**: a slot built locally as 09:00 is stored as a UTC `timestamp_ms`; if
  the test runner's `TZ` differs from the assumed clinic zone, the
  `YYYY-MM-DD` derived from an ISO `start` can land on the wrong day, breaking
  `availableDays` / `create` date matching.
- **Mitigation**: pin `process.env.TZ` for the test process (e.g. a fixed zone),
  avoid dates near midnight, and document that production assumes one clinic TZ.

---

## 7. Acceptance Checklist (User Story → Proving Tests)

Each spec requirement maps to the test(s) that prove it.

- [ ] Role selectable at sign-up; doctor can add specialty → **E2E-1**
- [ ] `/dashboard` branches by `session.user.role` → **E2E-1, E2E-2**
- [ ] Doctor publishes weekly availability → **`availability.set` happy** + **E2E-1**
- [ ] Availability replace semantics (set overwrites) → **`availability.set` replace/clear**
- [ ] Only doctors set availability → **`availability.set` patient FORBIDDEN**
- [ ] `availability.mine` returns caller's own → **`availability.mine` happy + isolation**
- [ ] Doctor index lists only doctors → **`doctors.list` happy** + **E2E-2**
- [ ] Doctor detail returns doctor + availability → **`doctors.get` happy**
- [ ] Unknown doctor → NOT_FOUND → **`doctors.get` NOT_FOUND** (+ patient-id gap test)
- [ ] Available days computed over a range → **`availableDays` happy/edge**
- [ ] Open 30-min slots per day → **`slots` happy** + **`generateDaySlots` unit**
- [ ] Slots exclude already-booked → **`slots` excludes booked** + **`overlaps` unit** + **E2E-2**
- [ ] Slots exclude past times → **`slots` excludes past** (+ fake clock)
- [ ] Partial trailing slot never offered → **`generateDaySlots` partial-drop unit**
- [ ] Patient books an open slot → **`appointments.create` happy** + **E2E-2**
- [ ] Only patients book → **`create` doctor FORBIDDEN**
- [ ] Booking a taken slot conflicts → **`create` CONFLICT (taken)** + **E2E-4**
- [ ] Booking outside availability conflicts → **`create` CONFLICT (not in availability)**
- [ ] Booked slot disappears from picker → **`slots` excludes booked** + **E2E-2**
- [ ] Appointment shows on both dashboards → **`appointments.mine` doctor & patient** + **E2E-2**
- [ ] `appointments.mine` is role-aware & sorted → **`mine` doctor/patient/sort**
- [ ] Either participant can cancel → **`cancel` patient & doctor happy**
- [ ] Non-participant cannot cancel → **`cancel` FORBIDDEN**
- [ ] Cancel unknown id → NOT_FOUND → **`cancel` NOT_FOUND**
- [ ] Cancellation frees the slot & reflects both sides → **`cancel` side-effect** + **E2E-3**
- [ ] Double-booking prevented (supported flow) → **`create` CONFLICT** + **E2E-4**
- [ ] All app procedures require auth → **per-procedure UNAUTHORIZED** + **E2E-5**

---

## 8. CI Notes

### Recommended pipeline order (fail fast → slow)
1. **typecheck** — `pnpm check-types` (already exists; maps to `turbo run check-types`).
2. **lint** — *not yet configured*. `turbo lint` is wired but no package defines
   a `lint` script (`CLAUDE.md`). Add a `lint` script per package to activate
   this stage; until then it is a no-op.
3. **unit** — Vitest on `packages/api/src/lib/slots.ts` (no DB, fast).
4. **integration** — Vitest on routers against a fresh libSQL test DB
   (seed + reset per test). Requires `DATABASE_URL` pointed at the test DB and
   `TZ` pinned.
5. **e2e** — Playwright against the built/dev web app on `:3001` (start the app,
   seed DB, run, tear down). Slowest; runs last.

### Turbo mapping
- Add `test:unit`, `test:integration`, `test:e2e` (and `lint`) scripts to the
  relevant `package.json`s and corresponding tasks in `turbo.json` so Turborepo
  caches and fans them out with `-F <package>` filters, mirroring the existing
  `build` / `check-types` tasks.
- Declare task dependencies in `turbo.json` so `test:integration` and `test:e2e`
  depend on `check-types` (and a `db:push` setup step for the test DB), keeping
  the fail-fast order without hand-sequencing in CI.
- Gate merges on stages 1–4 always; run stage 5 (e2e) on PRs to the default
  branch (or nightly) to keep PR feedback fast.
