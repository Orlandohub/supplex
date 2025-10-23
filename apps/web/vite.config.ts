import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import path from "path";

// CRITICAL: Disable Remix plugin during tests to avoid routing conflicts
// The Remix plugin interferes with Vitest by trying to handle routing in test mode
// When mode === 'test', we exclude the plugin to allow pure component testing
export default defineConfig(({ mode }) => ({
  plugins:
    mode === "test"
      ? []
      : [
          remix({
            future: {
              v3_fetcherPersist: true,
              v3_relativeSplatPath: true,
              v3_throwAbortReason: true,
            },
          }),
        ],
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
  },
}));
