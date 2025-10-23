import { createClient } from "@supabase/supabase-js";
import type { Database } from "@supplex/types";

// Environment variables with development defaults

const supabaseUrl =
  process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key";

// Only validate in production
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable in production"
  );
}

// Create Supabase admin client for server-side operations
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Public client for regular operations (using anon key)
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : supabaseAdmin;
