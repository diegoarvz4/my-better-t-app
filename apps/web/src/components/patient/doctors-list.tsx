"use client";

import { buttonVariants } from "@my-better-t-app/ui/components/button";
import { Card } from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronRight, Search, Star } from "lucide-react";
import Link from "next/link";

import { orpc } from "@/utils/orpc";

function getInitials(name: string): string {
  const cleaned = name.replace(/^Dr\.?\s+/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function DoctorsList() {
  const doctors = useQuery(orpc.doctors.list.queryOptions());

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="font-bold text-3xl tracking-tight">Find a doctor</h1>
        <p className="mt-1 text-muted-foreground">
          Browse specialists and book a time that works for you.
        </p>
      </header>

      <div className="relative mb-6">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or specialty…" type="search" />
      </div>

      {doctors.isLoading ? (
        <p className="text-muted-foreground">Loading doctors…</p>
      ) : doctors.isError ? (
        <p className="text-red-500">{doctors.error.message}</p>
      ) : !doctors.data || doctors.data.length === 0 ? (
        <p className="text-muted-foreground">No doctors are available right now.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {doctors.data.map((doctor) => (
            <Link className="block" href={`/doctors/${doctor.id}`} key={doctor.id}>
              <Card className="h-full p-5 transition-colors hover:bg-muted/50">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-sm">
                    {getInitials(doctor.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-base">{doctor.name}</h2>
                    <p className="truncate text-muted-foreground text-sm">
                      {doctor.specialty ?? "General practice"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="font-medium">4.9</span>
                  <span className="text-muted-foreground">· Next: Today</span>
                </div>

                <div className="my-4 border-border border-t" />

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-primary text-sm">
                    <Calendar className="h-4 w-4" />
                    Available this week
                  </span>
                  <span className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Book
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
