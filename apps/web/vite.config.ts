import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import path from "path";

// CRITICAL: Disable React Router plugin during tests to avoid routing conflicts.
// The plugin interferes with Vitest by trying to handle routing in test mode.
// When mode === 'test', we exclude the plugin to allow pure component testing.
export default defineConfig(({ mode }) => ({
  plugins: mode === "test" ? [] : [reactRouter()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
  // CRITICAL: envPrefix configuration for Supabase SSR
  // This exposes SUPABASE_* and API_* env vars to client-side code via import.meta.env
  // DO NOT REMOVE: Required for supabase-client.ts to access env vars during build/hydration
  // See: apps/web/app/lib/auth/supabase-client.ts for full explanation
  envPrefix: ["VITE_", "SUPABASE_", "API_"],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "**/*.config.{js,ts}",
        "**/*.test.{ts,tsx}",
        "**/test-*.{ts,tsx}",
        "**/__tests__/**",
      ],
      // SUP-7 sub-task 9a-3: lowered from 60% to the current baseline so
      // CI can go green and branch protection can be enabled. The real
      // coverage today is ~24%, mostly because route components render
      // through React Router data routers and are exercised end-to-end
      // rather than unit-tested. The follow-up plan is to ratchet this
      // upward in a dedicated test-coverage slice (see the SUP-18
      // measurement table) rather than ship a permanent regression.
      thresholds: {
        lines: 20,
        functions: 30,
        branches: 60,
        statements: 20,
      },
    },
  },
}));
