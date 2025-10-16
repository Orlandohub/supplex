import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@supplex/types';

// Environment variables validation
// In browser, get from window.ENV; on server, get from process.env
const getEnv = () => {
  if (typeof window !== 'undefined' && window.ENV) {
    return window.ENV;
  }
  return process.env;
};

const env = getEnv();
const supabaseUrl = env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Only validate in production
if (process.env.NODE_ENV === 'production') {
  if (!env.SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL environment variable in production');
  }
  
  if (!env.SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_ANON_KEY environment variable in production');
  }
}

// Create Supabase client with auth configuration
export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Configure cookie-based session management for SSR
      storage: undefined, // Disable localStorage for SSR compatibility
      autoRefreshToken: true,
      persistSession: false, // We'll handle sessions server-side
      detectSessionInUrl: true, // Enable OAuth callback detection
    },
    // Configure database options
    db: {
      schema: 'public',
    },
    // Configure realtime (disabled for MVP)
    realtime: {
      params: {
        eventsPerSecond: -1, // Disabled
      },
    },
  }
);

// Browser-only client for client-side operations
let browserClient: SupabaseClient<Database> | null = null;

export function getBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserClient should only be called in the browser');
  }
  
  if (!browserClient) {
    browserClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true, // Enable localStorage for client-side
        detectSessionInUrl: true,
        flowType: 'pkce', // Use PKCE flow for better security
      },
    });
  }
  
  return browserClient;
}

export type { Database } from '@supplex/types';
