import { createDb } from "@my-better-t-app/db";
import * as schema from "@my-better-t-app/db/schema/auth";
import { env } from "@my-better-t-app/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";

export function createAuth() {
  const db = createDb();

  // Build provider list at startup — only register providers that have credentials.
  // Google uses OIDC discovery; Facebook uses plain OAuth2 (no standard discovery endpoint).
  const oauthProviders: GenericOAuthConfig[] = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    oauthProviders.push({
      providerId: "google",
      discoveryUrl:
        "https://accounts.google.com/.well-known/openid-configuration",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      scopes: ["openid", "email", "profile"],
    });
  }

  if (env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET) {
    oauthProviders.push({
      providerId: "facebook",
      authorizationUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
      userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email,picture",
      clientId: env.FACEBOOK_CLIENT_ID,
      clientSecret: env.FACEBOOK_CLIENT_SECRET,
      scopes: ["email", "public_profile"],
    });
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "patient",
          input: true,
        },
        specialty: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const role = (user as { role?: string }).role;
            return {
              data: {
                ...user,
                role: role?.length ? role : "patient",
              },
            };
          },
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [
      nextCookies(),
      ...(oauthProviders.length ? [genericOAuth({ config: oauthProviders })] : []),
    ],
  });
}

export const auth = createAuth();
