"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { MonthCalendar, toDateKey } from "@/components/calendar/month-calendar";

import { orpc } from "@/utils/orpc";

function todayKey(): string {
  return toDateKey(new Date());
}

function monthBounds(d: Date): { from: string; to: string } {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toDateKey(first), to: toDateKey(last) };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function DoctorBooking({ id }: { id: string }) {
  const qc = useQueryClient();
  const minDate = todayKey();

  const [range, setRange] = useState<{ from: string; to: string }>(() => monthBounds(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const doctor = useQuery(orpc.doctors.get.queryOptions({ input: { id } }));

  const days = useQuery(
    orpc.appointments.availableDays.queryOptions({
      input: { doctorId: id, from: range.from, to: range.to },
    }),
  );

  const slots = useQuery(
    orpc.appointments.slots.queryOptions({
      input: { doctorId: id, date: selectedDate ?? "" },
      enabled: !!selectedDate,
    }),
  );

  const book = useMutation(
    orpc.appointments.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.appointments.key() });
        setReason("");
        setSelectedSlot(null);
        toast.success("Appointment booked");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (doctor.isLoading) {
    return <div className="mx-auto w-full max-w-4xl p-6 text-muted-foreground">Loading…</div>;
  }
  if (doctor.isError || !doctor.data) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6">
        <p className="text-destructive">{doctor.error?.message ?? "Doctor not found"}</p>
        <Link href="/doctors" className="underline">
          Back to doctors
        </Link>
      </div>
    );
  }

  const openSlots = slots.data ?? [];

  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function confirmBooking() {
    if (!selectedSlot) return;
    book.mutate({
      doctorId: id,
      start: selectedSlot,
      reason: reason.trim() === "" ? undefined : reason.trim(),
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <Link
        href="/doctors"
        className="inline-flex items-center gap-1.5 font-medium text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to doctors
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-lg text-primary">
          {initials(doctor.data.name)}
        </div>
        <div>
          <h1 className="font-bold text-2xl">{doctor.data.name}</h1>
          <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
            {doctor.data.specialty ?? "General practice"}
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              4.9
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Pick a day</h2>
          <MonthCalendar
            selected={selectedDate}
            onSelectDate={selectDate}
            markedDays={days.data ?? []}
            minDate={minDate}
            onMonthChange={(firstDay, lastDay) => setRange({ from: firstDay, to: lastDay })}
          />
          {days.isLoading ? (
            <p className="text-muted-foreground text-xs">Loading available days…</p>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? `Open slots · ${formatDayLabel(selectedDate)}` : "Select a day"}
            </CardTitle>
            <CardDescription>
              {selectedDate
                ? "Choose a time that works for you."
                : "Pick a highlighted day on the calendar."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedDate ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    value={reason}
                    placeholder="e.g. annual check-up"
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                {slots.isLoading ? (
                  <p className="text-muted-foreground">Loading slots…</p>
                ) : openSlots.length === 0 ? (
                  <p className="text-muted-foreground">No open slots on this day.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {openSlots.map((slot) => {
                      const isSlotSelected = selectedSlot === slot.start;
                      return (
                        <Button
                          key={slot.start}
                          type="button"
                          variant="outline"
                          aria-pressed={isSlotSelected}
                          className={cn(
                            isSlotSelected &&
                              "border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                          )}
                          onClick={() => setSelectedSlot(slot.start)}
                        >
                          {formatTime(slot.start)}
                        </Button>
                      );
                    })}
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full"
                  disabled={!selectedSlot || book.isPending}
                  onClick={confirmBooking}
                >
                  {book.isPending ? "Booking…" : "Confirm booking"}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
