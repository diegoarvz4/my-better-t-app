"use client";

import type { authClient } from "@/lib/auth-client";

// Replaced by the Doctor UI agent. Calendar of days -> appointments with
// patients, plus weekly availability editor.
export default function DoctorDashboard({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Doctor dashboard</h1>
      <p className="text-muted-foreground">Welcome, Dr. {session.user.name}</p>
    </div>
  );
}
