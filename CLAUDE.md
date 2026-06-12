# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Better-T-Stack monorepo: a single Next.js 16 (React 19) fullstack app where the backend lives in-process as Next.js route handlers. There is no separate server — "backend: self". pnpm workspaces + Turborepo + the pnpm catalog (shared dependency versions are pinned in `pnpm-workspace.yaml` under `catalog:`, referenced as `"dep": "catalog:"` in package.json).

## Commands

Run from the repo root (Turborepo fans out with `-F <package>` filters):

- `pnpm dev` — start everything in dev mode; web serves on **http://localhost:3001**
- `pnpm dev:web` — web app only
- `pnpm build` — build all
- `pnpm check-types` — TypeScript typecheck across the workspace (there is **no test runner and no lint task** configured; `turbo lint` is wired but no package defines a `lint` script)
- `pnpm db:local` — start a local SQLite via `turso dev --db-file local.db`
- `pnpm db:push` — push Drizzle schema to the DB (no migration files)
- `pnpm db:generate` / `pnpm db:migrate` — generate/apply SQL migrations in `packages/db/src/migrations`
- `pnpm db:studio` — Drizzle Studio UI

## Layout

- `apps/web` — the only app. Next.js App Router. Owns route handlers, pages, client components, and the `.env` file that everything reads.
- `packages/api` — oRPC router + procedure definitions and request context (depends on auth + db)
- `packages/auth` — Better-Auth config (depends on db)
- `packages/db` — Drizzle + libSQL client and schema; owns `drizzle.config.ts`
- `packages/env` — type-safe env via `@t3-oss/env`; `./server` and `./web` exports
- `packages/ui` — shared shadcn/ui primitives, imported as `@my-better-t-app/ui/components/<name>`
- `packages/config` — shared `tsconfig.base.json`

Packages export raw `./src/*.ts` (no build step); consumers import TypeScript source directly, e.g. `@my-better-t-app/api/routers/index`.

## How the request flow fits together

The API is **oRPC**, exposed through two Next.js catch-all route handlers in `apps/web/src/app/api`:

- `api/rpc/[[...rest]]/route.ts` — mounts the oRPC `RPCHandler` at `/api/rpc` and an `OpenAPIHandler` (with Scalar reference UI) at `/api/rpc/api-reference`. Both build `Context` per request via `createContext`.
- `api/auth/[...all]/route.ts` — Better-Auth handler.

Server side:
- `packages/api/src/index.ts` defines `publicProcedure` and `protectedProcedure`. `protectedProcedure` applies a `requireAuth` middleware that throws `ORPCError("UNAUTHORIZED")` when `context.session?.user` is absent.
- `packages/api/src/context.ts` resolves the Better-Auth session from request headers and puts it on `context.session`.
- `packages/api/src/routers/index.ts` is the single `appRouter` — **add new procedures here**. Its `AppRouter` type is exported and consumed by the client for end-to-end type safety.

Client side (`apps/web/src/utils/orpc.ts`):
- An `RPCLink` posts to `/api/rpc` with `credentials: "include"`; during SSR it forwards incoming `next/headers` so the session cookie reaches the handler.
- `client` is typed as `AppRouterClient`; `orpc` wraps it with `@orpc/tanstack-query` utils. Use TanStack Query through `orpc` in components. `Providers` (in `apps/web/src/components/providers.tsx`) supplies `QueryClientProvider` + theme + Sonner toaster; query errors surface as toasts via the shared `QueryCache.onError`.

Auth:
- Server `auth` instance in `packages/auth/src/index.ts` uses the Drizzle adapter (sqlite), email/password enabled, `nextCookies()` plugin. The Better-Auth schema lives in `packages/db/src/schema/auth.ts` and is the source for `protectedProcedure`'s session.
- Client `authClient` in `apps/web/src/lib/auth-client.ts`.

## Conventions & gotchas

- **Env vars** are validated in `packages/env`. Server vars (`DATABASE_URL`, `BETTER_AUTH_SECRET` ≥32 chars, `BETTER_AUTH_URL`, `CORS_ORIGIN`) live in **`apps/web/.env`** — `drizzle.config.ts` reads it via a relative `../../apps/web/.env` path. Add new vars to the relevant schema in `packages/env`, not ad-hoc `process.env`.
- DB schema is split per-domain under `packages/db/src/schema/` and re-exported from `schema/index.ts`. Add new tables there.
- Shared UI components belong in `packages/ui`; add them with `npx shadcn@latest add <name> -c packages/ui`. App-specific blocks use the shadcn CLI from `apps/web`.
- Validation uses **Zod v4** (`@orpc/zod/zod4`); the OpenAPI handler converts Zod schemas to JSON Schema.
- React Compiler is enabled (`babel-plugin-react-compiler`).
