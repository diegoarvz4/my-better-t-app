import { db } from "@my-better-t-app/db";
import { availability as availabilityTable } from "@my-better-t-app/db/schema/app";
import { user } from "@my-better-t-app/db/schema/auth";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

export const doctorsRouter = {
  list: protectedProcedure.handler(async () => {
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        specialty: user.specialty,
      })
      .from(user)
      .where(eq(user.role, "doctor"));
    return rows;
  }),

  get: protectedProcedure.input(z.object({ id: z.string() })).handler(async ({ input }) => {
    const [doctor] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        specialty: user.specialty,
      })
      .from(user)
      .where(and(eq(user.id, input.id), eq(user.role, "doctor")));

    if (!doctor) {
      throw new ORPCError("NOT_FOUND", { message: "Doctor not found" });
    }

    const slots = await db
      .select()
      .from(availabilityTable)
      .where(eq(availabilityTable.doctorId, input.id));

    return { ...doctor, availability: slots };
  }),
};
