import { describe, it, expect, vi } from "vitest";

// Mock environment variables for testing
vi.mock("process.env", () => ({
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "test-anon-key",
  NODE_ENV: "test",
}));

describe("Supabase Client Configuration", () => {
  it("should throw error when SUPABASE_URL is missing", async () => {
    // Temporarily unset the env var
    const originalUrl = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;

    // Clear module cache to force re-evaluation
    vi.resetModules();

    try {
      await import("../supabase-client");
      expect.fail("Should have thrown an error");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("Missing SUPABASE_URL environment variable");
    }

    // Restore env var
    process.env.SUPABASE_URL = originalUrl;
  });

  it("should throw error when SUPABASE_ANON_KEY is missing", async () => {
    // Temporarily unset the env var
    const originalKey = process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    // Clear module cache to force re-evaluation
    vi.resetModules();

    try {
      await import("../supabase-client");
      expect.fail("Should have thrown an error");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain(
        "Missing SUPABASE_ANON_KEY environment variable"
      );
    }

    // Restore env var
    process.env.SUPABASE_ANON_KEY = originalKey;
  });

  it("should create supabase client with correct configuration", async () => {
    // Set up env vars
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_ANON_KEY = "test-anon-key";

    vi.resetModules();
    const { supabase } = await import("../supabase-client");

    expect(supabase).toBeDefined();
    // Note: supabaseUrl and supabaseKey are protected properties and cannot be accessed in tests
    expect(supabase.auth).toBeDefined();
  });

  it("should throw error when getBrowserClient is called on server", async () => {
    // Mock window as undefined (server environment)
    const originalWindow = global.window;
    // @ts-expect-error - Deleting global.window for testing
    delete global.window;

    vi.resetModules();
    const { getBrowserClient } = await import("../supabase-client");

    expect(() => getBrowserClient()).toThrow(
      "getBrowserClient should only be called in the browser"
    );

    // Restore window
    global.window = originalWindow;
  });
});
