"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import { Card, CardContent } from "@my-better-t-app/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import type { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type AppointmentStatus = "scheduled" | "completed" | "cancelled" | string;

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const styles: Record<string, string> = {
    scheduled: "bg-primary/10 text-primary",
    completed: "bg-green-500/10 text-green-600 dark:text-green-400",
    cancelled: "bg-destructive/10 text-destructive",
  };
  const className = styles[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

type Appointment = {
  id: string;
  doctorName: string;
  start: string;
  status: AppointmentStatus;
  reason?: string | null;
};

function AppointmentCard({
  appointment,
  onCancel,
  cancelDisabled,
}: {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  cancelDisabled?: boolean;
}) {
  const isScheduled = appointment.status === "scheduled";
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold">{appointment.doctorName}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(appointment.start)}
              </p>
            </div>
            <StatusBadge status={appointment.status} />
          </div>
          {appointment.reason ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageSquare className="size-4 shrink-0" />
              {appointment.reason}
            </p>
          ) : null}
          {isScheduled && onCancel ? (
            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={cancelDisabled}
                onClick={() => onCancel(appointment.id)}
              >
                Cancel appointment
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PatientDashboard({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const qc = useQueryClient();
  const appointments = useQuery(orpc.appointments.mine.queryOptions());

  const cancel = useMutation(
    orpc.appointments.cancel.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.appointments.key() });
        toast.success("Appointment cancelled");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const list = appointments.data ?? [];
  const now = Date.now();
  const upcoming = list
    .filter(
      (a) => a.status === "scheduled" && new Date(a.start).getTime() >= now,
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const past = list
    .filter(
      (a) => !(a.status === "scheduled" && new Date(a.start).getTime() >= now),
    )
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My appointments</h1>
          <p className="text-muted-foreground">Welcome, {session.user.name}</p>
        </div>
        <Button nativeButton={false} render={<Link href="/doctors" />}>
          <Plus className="size-4" />
          Book an appointment
        </Button>
      </div>

      {appointments.isLoading ? (
        <p className="text-muted-foreground">Loading appointments…</p>
      ) : appointments.isError ? (
        <p className="text-destructive">{appointments.error.message}</p>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              You have no appointments yet.{" "}
              <Link href="/doctors" className="text-primary underline">
                Book one
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">No upcoming appointments.</p>
            ) : (
              upcoming.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  onCancel={(id) => cancel.mutate({ id })}
                  cancelDisabled={cancel.isPending}
                />
              ))
            )}
          </section>

          {past.length > 0 ? (
            <section className="space-y-3 opacity-70">
              <h2 className="text-lg font-semibold">Past &amp; cancelled</h2>
              {past.map((a) => (
                <AppointmentCard key={a.id} appointment={a} />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
