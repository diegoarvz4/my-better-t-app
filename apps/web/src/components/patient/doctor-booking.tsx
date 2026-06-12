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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function DoctorBooking({ id }: { id: string }) {
  const qc = useQueryClient();
  const minDate = todayKey();

  const [range, setRange] = useState<{ from: string; to: string }>(() => monthBounds(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
        toast.success("Appointment booked");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (doctor.isLoading) {
    return <div className="mx-auto w-full max-w-3xl p-6 text-muted-foreground">Loading…</div>;
  }
  if (doctor.isError || !doctor.data) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <p className="text-red-500">{doctor.error?.message ?? "Doctor not found"}</p>
        <Link href="/doctors" className="underline">
          Back to doctors
        </Link>
      </div>
    );
  }

  const openSlots = slots.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/doctors" className="text-sm text-muted-foreground underline">
          ← Back to doctors
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{doctor.data.name}</h1>
        <p className="text-muted-foreground">{doctor.data.specialty ?? "General practice"}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Pick a day</h2>
          <MonthCalendar
            selected={selectedDate}
            onSelectDate={setSelectedDate}
            markedDays={days.data ?? []}
            minDate={minDate}
            onMonthChange={(firstDay, lastDay) => setRange({ from: firstDay, to: lastDay })}
          />
          {days.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading available days…</p>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedDate ? "Open slots" : "Select a day"}</CardTitle>
            <CardDescription>
              {selectedDate
                ? "Choose a time to book your appointment."
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
                  <div className="flex flex-wrap gap-2">
                    {openSlots.map((slot) => (
                      <Button
                        key={slot.start}
                        variant="outline"
                        disabled={book.isPending}
                        onClick={() =>
                          book.mutate({
                            doctorId: id,
                            start: slot.start,
                            reason: reason.trim() === "" ? undefined : reason.trim(),
                          })
                        }
                      >
                        {new Date(slot.start).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
