"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@my-better-t-app/ui/components/card";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { MonthCalendar, toDateKey } from "@/components/calendar/month-calendar";
import AvailabilityEditor from "@/components/doctor/availability-editor";
import type { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

function formatTimeRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${new Date(start).toLocaleTimeString([], opts)} – ${new Date(end).toLocaleTimeString([], opts)}`;
}

function formatSelectedDate(key: string): string {
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function DoctorDashboard({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const qc = useQueryClient();
  const appts = useQuery(orpc.appointments.mine.queryOptions());

  const [selected, setSelected] = useState<string>(() => toDateKey(new Date()));

  const cancel = useMutation(
    orpc.appointments.cancel.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.appointments.mine.queryKey() });
        toast.success("Cancelled");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const appointments = appts.data ?? [];

  const markedDays = new Set(
    appointments.filter((a) => a.status === "scheduled").map((a) => toDateKey(new Date(a.start))),
  );

  const dayAppointments = appointments
    .filter((a) => toDateKey(new Date(a.start)) === selected)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Doctor dashboard</h1>
        <p className="text-muted-foreground">Welcome, Dr. {session.user.name}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-2">
          <MonthCalendar selected={selected} onSelectDate={setSelected} markedDays={markedDays} />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Appointments · {formatSelectedDate(selected)}</CardTitle>
              {!appts.isLoading ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
                  {dayAppointments.length}
                </span>
              ) : null}
            </div>
            <CardDescription>
              {appts.isLoading
                ? "Loading appointments..."
                : `${dayAppointments.length} appointment${dayAppointments.length === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appts.isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : dayAppointments.length === 0 ? (
              <p className="text-muted-foreground">No appointments on this day.</p>
            ) : (
              <ul className="space-y-3">
                {dayAppointments.map((a) => {
                  const isCancelled = a.status === "cancelled";
                  return (
                    <li key={a.id} className="rounded-lg border border-border bg-muted/40 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials(a.patientName)}
                          </span>
                          <div className="space-y-0.5">
                            <span className="font-medium">{a.patientName}</span>
                            <div className="text-sm text-muted-foreground">
                              {formatTimeRange(a.start, a.end)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                              isCancelled
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isCancelled ? "bg-destructive" : "bg-primary",
                              )}
                            />
                            {a.status === "scheduled" ? "Scheduled" : "Cancelled"}
                          </span>
                          {a.status === "scheduled" ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate({ id: a.id })}
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {a.reason ? (
                        <div className="mt-2 text-sm text-muted-foreground">{a.reason}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AvailabilityEditor />
    </div>
  );
}
