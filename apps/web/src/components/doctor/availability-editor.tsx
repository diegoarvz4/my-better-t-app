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
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Row = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export default function AvailabilityEditor() {
  const qc = useQueryClient();
  const avail = useQuery(orpc.availability.mine.queryOptions());

  const [rows, setRows] = useState<Row[]>([]);

  // Seed local editor state from the server once data arrives.
  useEffect(() => {
    if (avail.data) {
      setRows(
        avail.data.map((a) => ({
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
        })),
      );
    }
  }, [avail.data]);

  const setAvail = useMutation(
    orpc.availability.set.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.availability.mine.queryKey() });
        toast.success("Availability saved");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    setAvail.mutate({ slots: rows });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly availability</CardTitle>
        <CardDescription>Set the hours patients can book each day.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {avail.isLoading ? (
          <p className="text-muted-foreground">Loading availability...</p>
        ) : (
          <>
            {rows.length === 0 ? (
              <p className="text-muted-foreground">
                No availability set. Add a row to get started.
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Day of week"
                      className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                      value={row.dayOfWeek}
                      onChange={(e) => updateRow(index, { dayOfWeek: Number(e.target.value) })}
                    >
                      {WEEKDAYS.map((name, dow) => (
                        <option key={dow} value={dow}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      aria-label="Start time"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={row.startTime}
                      onChange={(e) => updateRow(index, { startTime: e.target.value })}
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <input
                      type="time"
                      aria-label="End time"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={row.endTime}
                      onChange={(e) => updateRow(index, { endTime: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Remove row"
                      className="text-destructive"
                      onClick={() => removeRow(index)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus />
                Add row
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={setAvail.isPending}>
                {setAvail.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
