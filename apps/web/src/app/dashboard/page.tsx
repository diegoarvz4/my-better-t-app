import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import DoctorDashboard from "./doctor/doctor-dashboard";
import PatientDashboard from "./patient/patient-dashboard";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return session.user.role === "doctor" ? (
    <DoctorDashboard session={session} />
  ) : (
    <PatientDashboard session={session} />
  );
}
