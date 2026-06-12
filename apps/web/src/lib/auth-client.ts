import type { auth } from "@my-better-t-app/auth";
import { genericOAuthClient } from "better-auth/client/plugins";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), genericOAuthClient()],
});
