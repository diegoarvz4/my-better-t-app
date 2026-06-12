import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_ENV = {
  DATABASE_URL: "libsql://example.turso.io",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3001",
  CORS_ORIGIN: "http://localhost:3001",
  NODE_ENV: "test",
};

// `packages/env/src/server.ts` validates `process.env` eagerly at import time via
// `createEnv`. We exercise the real exported schema by setting process.env, then
// dynamically (re)importing the module so the validation runs against our values.
describe("env/server schema", () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("parses a valid server environment", async () => {
    Object.assign(process.env, VALID_ENV);
    const { env } = await import("./server");
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.BETTER_AUTH_SECRET).toBe(VALID_ENV.BETTER_AUTH_SECRET);
    expect(env.NODE_ENV).toBe("test");
  });

  it("defaults NODE_ENV to development when omitted", async () => {
    Object.assign(process.env, VALID_ENV);
    // Assigning `undefined` would coerce to the string "undefined"; truly omit it.
    delete process.env.NODE_ENV;
    const { env } = await import("./server");
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a BETTER_AUTH_SECRET shorter than 32 chars", async () => {
    Object.assign(process.env, VALID_ENV, { BETTER_AUTH_SECRET: "tooshort" });
    await expect(import("./server")).rejects.toThrow();
  });

  it("rejects an invalid BETTER_AUTH_URL", async () => {
    Object.assign(process.env, VALID_ENV, { BETTER_AUTH_URL: "not-a-url" });
    await expect(import("./server")).rejects.toThrow();
  });

  it("rejects a missing DATABASE_URL", async () => {
    Object.assign(process.env, VALID_ENV);
    process.env.DATABASE_URL = "";
    await expect(import("./server")).rejects.toThrow();
  });
});
