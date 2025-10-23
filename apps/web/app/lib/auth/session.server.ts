/**
 * Modern Supabase Server-Side Authentication for Remix
 * Using @supabase/ssr instead of deprecated auth-helpers
 *
 * SECURITY: Uses cookie utilities (parse/serialize) for proper cookie handling
 * following official Supabase Remix SSR documentation
 */

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { parse, serialize } from "cookie";
import type { Database } from "@supplex/types";

// Validate environment variables are set (fail loudly if missing)
if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required. Check apps/web/.env file.");
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY is required. Check apps/web/.env file.");
}

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required. Check apps/web/.env file.");
}

// Environment variables (validated above)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const sessionSecret = process.env.SESSION_SECRET;

// Create session storage for Remix cookies
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__supplex_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

/**
 * Create a Supabase server client for server-side operations (Modern SSR approach)
 *
 * SECURITY: Uses Remix's parse/serialize for proper cookie handling
 * Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=remix
 */
export function createSupabaseServerClient(
  request: Request,
  response: Response = new Response()
): SupabaseClient<Database> {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        // Use Remix's parse utility for secure cookie parsing
        const cookies = parse(request.headers.get("Cookie") ?? "");
        return cookies[name];
      },
      set(name: string, value: string, options: any) {
        // Use Remix's serialize utility for proper Set-Cookie header formatting
        response.headers.append("Set-Cookie", serialize(name, value, options));
      },
      remove(name: string, options: any) {
        // Use Remix's serialize utility to properly expire cookies
        response.headers.append(
          "Set-Cookie",
          serialize(name, "", { ...options, maxAge: 0 })
        );
      },
    },
  });
}

/**
 * Get the current user session from the request
 *
 * SECURITY: Uses getUser() instead of getSession() to validate session with Supabase Auth server
 * This prevents using tampered session data from cookies
 * Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client
 */
export async function getSession(request: Request): Promise<{
  session: any;
  user: any;
  supabase: SupabaseClient<Database>;
  response: Response;
}> {
  const response = new Response();
  const supabase = createSupabaseServerClient(request, response);

  // Use getUser() instead of getSession() for server-side validation
  // getUser() contacts the Supabase Auth server to validate the session
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Auth error:", error);
  }

  // Get session data only if user is authenticated
  let session = null;
  if (user) {
    const {
      data: { session: validatedSession },
    } = await supabase.auth.getSession();
    session = validatedSession;
  }

  return {
    session,
    user: user ?? null,
    supabase,
    response,
  };
}

/**
 * Require authentication for a route
 */
export async function requireAuth(request: Request): Promise<{
  user: any;
  session: any;
  supabase: SupabaseClient<Database>;
  response: Response;
}> {
  const { session, user, supabase, response } = await getSession(request);

  if (!session || !user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    const loginUrl = `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
    throw redirect(loginUrl);
  }

  return { user, session, supabase, response };
}

/**
 * Get authenticated user with tenant information
 */
export async function getAuthenticatedUser(request: Request): Promise<{
  user: any;
  session: any;
  supabase: SupabaseClient<Database>;
  response: Response;
  userRecord?: any;
}> {
  const { user, session, supabase, response } = await requireAuth(request);

  // Fetch user record from our database
  const { data: userRecord, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching user record:", error);
    throw new Error("Failed to fetch user data");
  }

  return { user, session, supabase, response, userRecord };
}

/**
 * Sign out the current user
 */
export async function signOut(request: Request): Promise<Response> {
  const { supabase, response } = await getSession(request);

  await supabase.auth.signOut();

  // Clear session cookie
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  return redirect("/login", {
    headers: [
      ...Array.from(response.headers.entries()),
      ["Set-Cookie", await sessionStorage.destroySession(session)],
    ],
  });
}

/**
 * Refresh tokens if needed
 */
export async function refreshTokens(request: Request): Promise<{
  session: any;
  user: any;
  supabase: SupabaseClient<Database>;
  response: Response;
}> {
  const response = new Response();
  const supabase = createSupabaseServerClient(request, response);

  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();

  if (error) {
    console.error("Token refresh error:", error);
    throw redirect("/login");
  }

  return {
    session,
    user: session?.user ?? null,
    supabase,
    response,
  };
}

/**
 * Helper to get headers with auth cookies
 */
export function getAuthHeaders(response: Response): HeadersInit {
  return Array.from(response.headers.entries());
}
