import { describe, expect, it } from "vitest";

import {
  dateFromParts,
  dayOfWeek,
  generateDaySlots,
  overlaps,
  parseHHMM,
  SLOT_MINUTES,
} from "./slots";

describe("parseHHMM", () => {
  it("converts midnight to 0 minutes", () => {
    expect(parseHHMM("00:00")).toBe(0);
  });

  it("converts an arbitrary time to minutes-since-midnight", () => {
    expect(parseHHMM("09:30")).toBe(570);
  });

  it("handles the end of the day", () => {
    expect(parseHHMM("23:59")).toBe(1439);
  });
});

describe("dateFromParts", () => {
  it("builds a local Date at the given minutes-since-midnight", () => {
    const d = dateFromParts("2026-06-12", 9 * 60 + 30);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June is month index 5
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });
});

describe("dayOfWeek", () => {
  it("returns 5 (Friday) for 2026-06-12", () => {
    expect(dayOfWeek("2026-06-12")).toBe(5);
  });

  it("returns 0 (Sunday) for 2026-06-14", () => {
    expect(dayOfWeek("2026-06-14")).toBe(0);
  });
});

describe("overlaps", () => {
  const base = "2026-06-12";
  const at = (mins: number) => dateFromParts(base, mins);

  it("returns true for partially overlapping ranges", () => {
    expect(overlaps(at(540), at(600), at(570), at(630))).toBe(true);
  });

  it("returns false for adjacent (touching) ranges", () => {
    expect(overlaps(at(540), at(570), at(570), at(600))).toBe(false);
  });

  it("returns false for fully disjoint ranges", () => {
    expect(overlaps(at(540), at(570), at(600), at(630))).toBe(false);
  });

  it("returns true when one range fully contains the other", () => {
    expect(overlaps(at(540), at(660), at(570), at(600))).toBe(true);
  });
});

describe("generateDaySlots", () => {
  it("produces the expected number of 30-min slots for a 9:00-11:00 range", () => {
    const slots = generateDaySlots("2026-06-12", [{ startTime: "09:00", endTime: "11:00" }]);
    expect(slots).toHaveLength(4);
  });

  it("aligns slot boundaries to SLOT_MINUTES", () => {
    const slots = generateDaySlots("2026-06-12", [{ startTime: "09:00", endTime: "10:00" }]);
    expect(slots[0].start.getHours()).toBe(9);
    expect(slots[0].start.getMinutes()).toBe(0);
    expect(slots[0].end.getMinutes()).toBe(SLOT_MINUTES % 60);
    expect(slots[1].start.getMinutes()).toBe(30);
  });

  it("drops a trailing partial slot that does not fit", () => {
    const slots = generateDaySlots("2026-06-12", [{ startTime: "09:00", endTime: "09:45" }]);
    expect(slots).toHaveLength(1);
    expect(slots[0].end.getMinutes()).toBe(30);
  });

  it("returns no slots for an empty range list", () => {
    expect(generateDaySlots("2026-06-12", [])).toHaveLength(0);
  });

  it("returns no slots when the range is shorter than one slot", () => {
    const slots = generateDaySlots("2026-06-12", [{ startTime: "09:00", endTime: "09:15" }]);
    expect(slots).toHaveLength(0);
  });

  it("merges and sorts slots across multiple ranges", () => {
    const slots = generateDaySlots("2026-06-12", [
      { startTime: "13:00", endTime: "14:00" },
      { startTime: "09:00", endTime: "10:00" },
    ]);
    expect(slots).toHaveLength(4);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].start.getTime()).toBeGreaterThanOrEqual(slots[i - 1].start.getTime());
    }
  });
});
