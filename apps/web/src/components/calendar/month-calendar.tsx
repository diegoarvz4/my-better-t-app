"use client";

import { cn } from "@my-better-t-app/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type MonthCalendarProps = {
  /** Selected day, YYYY-MM-DD */
  selected?: string | null;
  onSelectDate?: (date: string) => void;
  /** Days to highlight (e.g. days with availability or appointments) */
  markedDays?: Iterable<string>;
  /** Disable days before this YYYY-MM-DD */
  minDate?: string;
  /** Notify parent when the visible month changes (first day, YYYY-MM-DD) */
  onMonthChange?: (firstDay: string, lastDay: string) => void;
};

export function MonthCalendar({
  selected,
  onSelectDate,
  markedDays,
  minDate,
  onMonthChange,
}: MonthCalendarProps) {
  const today = new Date();
  const initial = selected ? new Date(`${selected}T00:00:00`) : today;
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const marked = new Set(markedDays ?? []);
  const todayKey = toDateKey(today);

  const firstOfMonth = new Date(view.year, view.month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.year, view.month, d));

  function changeMonth(delta: number) {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
    if (onMonthChange) {
      const last = new Date(next.getFullYear(), next.getMonth() + 1, 0);
      onMonthChange(toDateKey(next), toDateKey(last));
    }
  }

  return (
    <div className="w-full max-w-sm rounded-lg border p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded p-1 hover:bg-accent"
          onClick={() => changeMonth(-1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-medium">
          {MONTHS[view.month]} {view.year}
        </span>
        <button
          type="button"
          aria-label="Next month"
          className="rounded p-1 hover:bg-accent"
          onClick={() => changeMonth(1)}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const key = toDateKey(date);
          const isSelected = key === selected;
          const isToday = key === todayKey;
          const isMarked = marked.has(key);
          const isDisabled = minDate ? key < minDate : false;
          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate?.(key)}
              className={cn(
                "relative flex h-9 items-center justify-center rounded text-sm transition-colors",
                isDisabled && "cursor-not-allowed text-muted-foreground/40",
                !isDisabled && "hover:bg-accent",
                isToday && !isSelected && "font-semibold",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {date.getDate()}
              {isMarked && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
