"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@my-better-t-app/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    .filter((a) => a.status === "scheduled" && new Date(a.start).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const past = list
    .filter((a) => !(a.status === "scheduled" && new Date(a.start).getTime() >= now))
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My appointments</h1>
          <p className="text-muted-foreground">Welcome, {session.user.name}</p>
        </div>
        <Button render={<Link href="/doctors" />}>Book an appointment</Button>
      </div>

      {appointments.isLoading ? (
        <p className="text-muted-foreground">Loading appointments…</p>
      ) : appointments.isError ? (
        <p className="text-red-500">{appointments.error.message}</p>
      ) : list.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">
              You have no appointments yet.{" "}
              <Link href="/doctors" className="underline">
                Book one
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">No upcoming appointments.</p>
            ) : (
              upcoming.map((a) => (
                <Card key={a.id}>
                  <CardHeader>
                    <CardTitle>{a.doctorName}</CardTitle>
                    <CardDescription>{formatDateTime(a.start)}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="capitalize">Status: {a.status}</p>
                      {a.reason ? <p className="text-muted-foreground">Reason: {a.reason}</p> : null}
                    </div>
                    {a.status === "scheduled" ? (
                      <Button
                        variant="outline"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate({ id: a.id })}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          {past.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Past &amp; cancelled</h2>
              {past.map((a) => (
                <Card key={a.id} className="opacity-70">
                  <CardHeader>
                    <CardTitle>{a.doctorName}</CardTitle>
                    <CardDescription>{formatDateTime(a.start)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="capitalize">Status: {a.status}</p>
                    {a.reason ? <p className="text-muted-foreground">Reason: {a.reason}</p> : null}
                  </CardContent>
                </Card>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
