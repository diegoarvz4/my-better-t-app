"use client";

import type { authClient } from "@/lib/auth-client";

// Replaced by the Patient UI agent. List of the patient's appointments, link
// to the doctor index and booking flow.
export default function PatientDashboard({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Patient dashboard</h1>
      <p className="text-muted-foreground">Welcome, {session.user.name}</p>
    </div>
  );
}
