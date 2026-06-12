import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { appointmentsRouter } from "./appointments";
import { availabilityRouter } from "./availability";
import { doctorsRouter } from "./doctors";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  doctors: doctorsRouter,
  availability: availabilityRouter,
  appointments: appointmentsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
