import { describe, test, expect } from "bun:test";
import { loadConfig } from "../config";

/**
 * Tests for config.ts — JWT secret handling.
 *
 * SEC-006 made jwt.secret optional (JWKS is the primary verification method).
 * Uses loadConfig(envOverride) to simulate different environments
 * without relying on process.env mutation (Bun test freezes NODE_ENV).
 */

const BASE_ENV = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  DATABASE_URL: "postgresql://localhost:5432/test",
  SUPABASE_JWT_SECRET: undefined,
  JWT_SECRET: undefined,
  REDIS_URL: undefined,
  PORT: undefined,
  CORS_ORIGIN: undefined,
};

describe("JWT Config (SEC-006: jwt.secret optional)", () => {
  test("server starts without jwt.secret in production (JWKS-only mode)", () => {
    const cfg = loadConfig({ ...BASE_ENV, NODE_ENV: "production" });
    expect(cfg.jwt).toBeUndefined();
  });

  test("server starts without jwt.secret in development (JWKS-only mode)", () => {
    const cfg = loadConfig({ ...BASE_ENV, NODE_ENV: "development" });
    expect(cfg.jwt).toBeUndefined();
  });

  test("jwt.secret populated when SUPABASE_JWT_SECRET is set", () => {
    const cfg = loadConfig({
      ...BASE_ENV,
      NODE_ENV: "production",
      SUPABASE_JWT_SECRET: "a-real-production-secret-that-is-long-enough",
    });
    expect(cfg.jwt?.secret).toBe(
      "a-real-production-secret-that-is-long-enough"
    );
  });

  test("jwt.secret populated when JWT_SECRET is set", () => {
    const cfg = loadConfig({
      ...BASE_ENV,
      NODE_ENV: "production",
      JWT_SECRET: "another-real-production-secret-long-enough",
    });
    expect(cfg.jwt?.secret).toBe("another-real-production-secret-long-enough");
  });

  test("SUPABASE_JWT_SECRET takes precedence over JWT_SECRET", () => {
    const cfg = loadConfig({
      ...BASE_ENV,
      NODE_ENV: "production",
      SUPABASE_JWT_SECRET: "primary-secret-supabase-jwt-secret-long",
      JWT_SECRET: "secondary-secret-jwt-secret-long-enough",
    });
    expect(cfg.jwt?.secret).toBe("primary-secret-supabase-jwt-secret-long");
  });

  test("jwt.secret rejected if shorter than 32 chars", () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        NODE_ENV: "production",
        SUPABASE_JWT_SECRET: "short",
      })
    ).toThrow("Invalid configuration");
  });

  test("verification mode detection: JWKS + HMAC when secret present", () => {
    const cfg = loadConfig({
      ...BASE_ENV,
      SUPABASE_JWT_SECRET: "a-real-production-secret-that-is-long-enough",
    });
    const mode = cfg.jwt?.secret
      ? "JWKS (primary) + HMAC fallback"
      : "JWKS only";
    expect(mode).toBe("JWKS (primary) + HMAC fallback");
  });

  test("verification mode detection: JWKS only when no secret", () => {
    const cfg = loadConfig({ ...BASE_ENV });
    const mode = cfg.jwt?.secret
      ? "JWKS (primary) + HMAC fallback"
      : "JWKS only";
    expect(mode).toBe("JWKS only");
  });
});
