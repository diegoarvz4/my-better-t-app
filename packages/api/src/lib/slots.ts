export const SLOT_MINUTES = 30;

export type TimeRange = { startTime: string; endTime: string };
export type SlotRange = { start: Date; end: Date };

/** "HH:MM" -> minutes since midnight */
export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** Build a local Date for `YYYY-MM-DD` at the given minutes-since-midnight. */
export function dateFromParts(dateStr: string, minutes: number): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

/** 0=Sun..6=Sat for a `YYYY-MM-DD` date string (local). */
export function dayOfWeek(dateStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).getDay();
}

/** Generate every 30-min slot inside the given time ranges for a date. */
export function generateDaySlots(dateStr: string, ranges: TimeRange[]): SlotRange[] {
  const slots: SlotRange[] = [];
  for (const range of ranges) {
    const end = parseHHMM(range.endTime);
    for (let t = parseHHMM(range.startTime); t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
      slots.push({
        start: dateFromParts(dateStr, t),
        end: dateFromParts(dateStr, t + SLOT_MINUTES),
      });
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** True if [aStart,aEnd) overlaps [bStart,bEnd). */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
