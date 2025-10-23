import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@supplex/types";

/**
 * CRITICAL: Environment Variable Configuration for Supabase Client
 * ================================================================
 *
 * This file handles Supabase client initialization for BOTH server and client contexts.
 * DO NOT MODIFY the environment variable loading logic without understanding the full flow.
 *
 * Environment Variable Sources (in priority order):
 *
 * 1. CLIENT-SIDE (Browser):
 *    - Primary: window.ENV.SUPABASE_URL (set by root.tsx loader)
 *    - This ensures server-validated env vars are passed to client
 *
 * 2. SERVER-SIDE (SSR):
 *    - process.env.SUPABASE_URL (loaded from apps/web/.env)
 *    - Node.js automatically loads .env files
 *
 * 3. BUILD-TIME (Vite):
 *    - import.meta.env.SUPABASE_URL (exposed via vite.config.ts envPrefix)
 *    - Only works because vite.config.ts has: envPrefix: ['SUPABASE_', 'API_']
 *
 * Required Configuration Files:
 * - apps/web/.env: Must contain SUPABASE_URL and SUPABASE_ANON_KEY
 * - apps/web/vite.config.ts: Must have envPrefix: ['VITE_', 'SUPABASE_', 'API_']
 * - apps/web/app/root.tsx: Must pass env vars to client via window.ENV
 *
 * DO NOT:
 * - Remove the multi-source fallback (breaks SSR or client hydration)
 * - Use placeholder/fallback values (security risk, breaks auth)
 * - Remove envPrefix from vite.config.ts (breaks client-side access)
 * - Change root.tsx env object (breaks window.ENV hydration)
 */

const getSupabaseUrl = (): string => {
  if (typeof window !== "undefined" && window.ENV?.SUPABASE_URL) {
    return window.ENV.SUPABASE_URL; // Browser: from server
  }
  // Server-side or build-time
  return import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL || "";
};

const getSupabaseAnonKey = (): string => {
  if (typeof window !== "undefined" && window.ENV?.SUPABASE_ANON_KEY) {
    return window.ENV.SUPABASE_ANON_KEY; // Browser: from server
  }
  // Server-side or build-time
  return (
    import.meta.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
  );
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

// Validate environment variables are set (fail loudly if missing)
if (!supabaseUrl || supabaseUrl === "") {
  console.error("SUPABASE_URL is not set. Check apps/web/.env file.");
}

if (!supabaseAnonKey || supabaseAnonKey === "") {
  console.error("SUPABASE_ANON_KEY is not set. Check apps/web/.env file.");
}

// Legacy export - use getBrowserClient() instead
// This client doesn't properly handle cookies for SSR
export const supabase: SupabaseClient<Database> = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
);

// Browser-only client for client-side operations
// Uses @supabase/ssr for proper cookie handling
let browserClient: SupabaseClient<Database> | null = null;

export function getBrowserClient(): SupabaseClient<Database> {
  if (typeof window === "undefined") {
    throw new Error("getBrowserClient should only be called in the browser");
  }

  if (!browserClient) {
    // Use createBrowserClient from @supabase/ssr
    // This automatically handles cookies for SSR compatibility
    browserClient = createBrowserClient<Database>(
      supabaseUrl!,
      supabaseAnonKey!
    );
  }

  return browserClient;
}

export type { Database } from "@supplex/types";
