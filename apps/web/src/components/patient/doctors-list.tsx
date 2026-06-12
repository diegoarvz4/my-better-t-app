"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@my-better-t-app/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { orpc } from "@/utils/orpc";

export default function DoctorsList() {
  const doctors = useQuery(orpc.doctors.list.queryOptions());

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Find a doctor</h1>

      {doctors.isLoading ? (
        <p className="text-muted-foreground">Loading doctors…</p>
      ) : doctors.isError ? (
        <p className="text-red-500">{doctors.error.message}</p>
      ) : !doctors.data || doctors.data.length === 0 ? (
        <p className="text-muted-foreground">No doctors are available right now.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {doctors.data.map((doctor) => (
            <Link key={doctor.id} href={`/doctors/${doctor.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{doctor.name}</CardTitle>
                  <CardDescription>{doctor.specialty ?? "General practice"}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
