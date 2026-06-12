"use client";
import { buttonVariants } from "@my-better-t-app/ui/components/button";
import { Card, CardContent, CardTitle } from "@my-better-t-app/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { orpc } from "@/utils/orpc";

export default function Home() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());
  const isHealthy = Boolean(healthCheck.data);

  return (
    <div className="container mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-primary" />
        Healthcare, simplified
      </span>

      <h1 className="mt-6 text-balance font-bold text-4xl tracking-tight sm:text-5xl">
        Book care that fits your schedule
      </h1>

      <p className="mt-4 max-w-xl text-balance text-muted-foreground">
        Find the right doctor, see real-time availability, and book an appointment in seconds — all
        in one place.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/doctors" className={buttonVariants({ size: "lg" })}>
          Find a doctor
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Sign in
        </Link>
      </div>

      <Card className="mt-12 w-full max-w-md py-4 text-left">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>System status</CardTitle>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${isHealthy ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className={`text-sm ${isHealthy ? "text-green-600" : "text-destructive"}`}>
                {healthCheck.isLoading ? "Checking..." : isHealthy ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {isHealthy
              ? "All systems operational — API reachable."
              : "API unreachable — some features may be unavailable."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
