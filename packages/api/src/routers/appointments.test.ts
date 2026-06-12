import { describe, expect, it } from "vitest";

import { dateFromParts, generateDaySlots, overlaps, SLOT_MINUTES } from "../lib/slots";

// NOTE: `toAppointment` in appointments.ts is a module-private helper and is not
// exported. Per the unit's instructions we do not export-hack production code, so
// instead we add further coverage of the pure slot helpers that the appointments
// router relies on (slot generation + booked-range overlap filtering).

describe("appointments slot logic", () => {
  it("generates contiguous 30-min slots covering a full work day", () => {
    const slots = generateDaySlots("2026-06-12", [{ startTime: "09:00", endTime: "17:00" }]);
    expect(slots).toHaveLength(16);
    expect(slots[0].start.getHours()).toBe(9);
    expect(slots.at(-1)?.end.getHours()).toBe(17);
  });

  it("each generated slot is exactly SLOT_MINUTES long", () => {
    const slots = generateDaySlots("2026-06-12", [{ startTime: "09:00", endTime: "10:00" }]);
    for (const slot of slots) {
      const minutes = (slot.end.getTime() - slot.start.getTime()) / 60000;
      expect(minutes).toBe(SLOT_MINUTES);
    }
  });

  it("filters out a slot that overlaps a booked appointment", () => {
    const date = "2026-06-12";
    const slots = generateDaySlots(date, [{ startTime: "09:00", endTime: "11:00" }]);
    const booked = { start: dateFromParts(date, 9 * 60), end: dateFromParts(date, 9 * 60 + 30) };
    const open = slots.filter((s) => !overlaps(s.start, s.end, booked.start, booked.end));
    expect(open).toHaveLength(3);
    expect(open.every((s) => s.start.getTime() !== booked.start.getTime())).toBe(true);
  });

  it("keeps all slots when no booking overlaps", () => {
    const date = "2026-06-12";
    const slots = generateDaySlots(date, [{ startTime: "09:00", endTime: "11:00" }]);
    const booked = { start: dateFromParts(date, 14 * 60), end: dateFromParts(date, 14 * 60 + 30) };
    const open = slots.filter((s) => !overlaps(s.start, s.end, booked.start, booked.end));
    expect(open).toHaveLength(slots.length);
  });
});
