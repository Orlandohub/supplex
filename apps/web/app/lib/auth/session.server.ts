/**
 * Modern Supabase Server-Side Authentication for Remix
 * Using @supabase/ssr instead of deprecated auth-helpers
 *
 * SECURITY: Uses cookie utilities (parse/serialize) for proper cookie handling
 * following official Supabase Remix SSR documentation
 */

import { createServerClient } from "@supabase/ssr";
import type {
  SupabaseClient,
  User as AuthUser,
  Session,
} from "@supabase/supabase-js";
import { createCookieSessionStorage, redirect } from "react-router";
import { parse, serialize, type SerializeOptions } from "cookie";
import type { Database } from "@supplex/types";
import { asUserRecord, type UserRecord } from "./user-record";

export {
  type UserRecord,
  asUserRecord,
  userRecordHasRole,
} from "./user-record";

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
      set(name: string, value: string, options: SerializeOptions) {
        // Use Remix's serialize utility for proper Set-Cookie header formatting
        response.headers.append("Set-Cookie", serialize(name, value, options));
      },
      remove(name: string, options: SerializeOptions) {
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
  session: Session | null;
  user: AuthUser | null;
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

  // Only log unexpected auth errors (not "session missing" which is normal for logged-out users)
  if (error && error.message !== "Auth session missing!") {
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
  user: AuthUser;
  session: Session;
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
 * Fast session check using getSession() (local JWT parse, no external HTTP call).
 *
 * SECURITY NOTE: This does NOT contact the Supabase Auth server to validate
 * the session â€” it only checks JWT format and expiry from the cookie. This is
 * safe for child loaders because:
 *   1. The root layout (_app.tsx) already calls getUser() on initial page load.
 *   2. The Elysia API server validates the JWT signature on every request.
 *   3. PostgREST also validates the JWT when the Supabase client queries the DB.
 */
export async function getSessionFast(request: Request): Promise<{
  session: Session | null;
  user: AuthUser | null;
  supabase: SupabaseClient<Database>;
  response: Response;
}> {
  const response = new Response();
  const supabase = createSupabaseServerClient(request, response);

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return { session: null, user: null, supabase, response };
  }

  return { session, user: session.user, supabase, response };
}

/**
 * Fast require-auth: redirects to login if no valid session cookie exists.
 * Uses getSession() (local) instead of getUser() (remote HTTP call).
 */
export async function requireAuthFast(request: Request): Promise<{
  user: AuthUser;
  session: Session;
  supabase: SupabaseClient<Database>;
  response: Response;
}> {
  const { session, user, supabase, response } = await getSessionFast(request);

  if (!session || !user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return { user, session, supabase, response };
}

/**
 * Fast version of getAuthenticatedUser â€” uses local session check + cached
 * userRecord from the Remix cookie session. Avoids the ~200-500ms external
 * HTTP call to Supabase Auth that getUser() makes on every invocation.
 */
export async function getAuthenticatedUserFast(request: Request): Promise<{
  user: AuthUser;
  session: Session;
  supabase: SupabaseClient<Database>;
  response: Response;
  userRecord: UserRecord;
}> {
  const { user, session, supabase, response } = await requireAuthFast(request);

  const remixSession = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const cachedUserRecord = remixSession.get("userRecord");
  const cacheTimestamp = remixSession.get("userRecordTimestamp");
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const isCacheValid =
    cachedUserRecord &&
    cachedUserRecord.id === user.id &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_TTL;

  if (isCacheValid) {
    const cachedRecord = asUserRecord(cachedUserRecord);
    if (cachedRecord) {
      return { user, session, supabase, response, userRecord: cachedRecord };
    }
  }

  const { data: userRecord, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !userRecord) {
    console.error("Error fetching user record:", error);
    throw new Error("Failed to fetch user data");
  }

  remixSession.set("userRecord", userRecord);
  remixSession.set("userRecordTimestamp", Date.now());
  response.headers.append(
    "Set-Cookie",
    await sessionStorage.commitSession(remixSession)
  );

  const narrowed = asUserRecord(userRecord);
  if (!narrowed) {
    throw new Error("User record returned from Supabase was empty");
  }
  return { user, session, supabase, response, userRecord: narrowed };
}

/**
 * Get authenticated user with tenant information
 * PERFORMANCE: Caches userRecord in session to avoid DB queries on every request
 */
export async function getAuthenticatedUser(request: Request): Promise<{
  user: AuthUser;
  session: Session;
  supabase: SupabaseClient<Database>;
  response: Response;
  userRecord: UserRecord;
}> {
  const { user, session, supabase, response } = await requireAuth(request);

  // Try to get cached userRecord from session (Performance optimization)
  const remixSession = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const cachedUserRecord = remixSession.get("userRecord");

  // Validate cache: check if it's for the same user and not too old
  const cacheTimestamp = remixSession.get("userRecordTimestamp");
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const isCacheValid =
    cachedUserRecord &&
    cachedUserRecord.id === user.id &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_TTL;

  if (isCacheValid) {
    // Return cached user record (saves ~50-150ms DB query)
    const cachedRecord = asUserRecord(cachedUserRecord);
    if (cachedRecord) {
      return { user, session, supabase, response, userRecord: cachedRecord };
    }
  }

  // Cache miss or expired - fetch from database
  const { data: userRecord, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !userRecord) {
    console.error("Error fetching user record:", error);
    throw new Error("Failed to fetch user data");
  }

  // Update session cache
  remixSession.set("userRecord", userRecord);
  remixSession.set("userRecordTimestamp", Date.now());

  // Add Set-Cookie header to persist updated session
  response.headers.append(
    "Set-Cookie",
    await sessionStorage.commitSession(remixSession)
  );

  const narrowed = asUserRecord(userRecord);
  if (!narrowed) {
    throw new Error("User record returned from Supabase was empty");
  }
  return { user, session, supabase, response, userRecord: narrowed };
}

/**
 * Get supplier info for a user (with session caching)
 * PERFORMANCE: Caches supplierInfo in session to avoid API calls on every navigation
 */
export async function getSupplierInfoCached(
  request: Request,
  userId: string,
  token: string,
  fetchSupplierFn: (
    userId: string,
    token: string
  ) => Promise<{ id: string; name: string } | null>
): Promise<{ id: string; name: string } | null> {
  // Try to get cached supplierInfo from session
  const remixSession = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const cachedSupplierInfo = remixSession.get("supplierInfo");

  // Validate cache: check if it's for the same user and not too old
  const cacheTimestamp = remixSession.get("supplierInfoTimestamp");
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const isCacheValid =
    cachedSupplierInfo &&
    cachedSupplierInfo.userId === userId &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_TTL;

  if (isCacheValid) {
    // Return cached supplier info (saves ~50-150ms API call)
    return { id: cachedSupplierInfo.id, name: cachedSupplierInfo.name };
  }

  // Cache miss or expired - fetch from API
  const supplierInfo = await fetchSupplierFn(userId, token);

  if (supplierInfo) {
    // Update session cache
    remixSession.set("supplierInfo", { ...supplierInfo, userId });
    remixSession.set("supplierInfoTimestamp", Date.now());

    // Note: We don't need to set headers here because the calling loader
    // will handle committing the session if needed
  }

  return supplierInfo;
}

/**
 * Invalidate supplier info cache in session
 * Call this when supplier data is updated
 */
export async function invalidateSupplierInfoCache(
  request: Request
): Promise<void> {
  const remixSession = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  remixSession.unset("supplierInfo");
  remixSession.unset("supplierInfoTimestamp");
}

/**
 * Sign out the current user
 * Clears session cache including cached userRecord and supplierInfo
 */
export async function signOut(request: Request): Promise<Response> {
  const { supabase, response } = await getSession(request);

  await supabase.auth.signOut();

  // Clear session cookie (also clears cached userRecord and supplierInfo)
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
  session: Session | null;
  user: AuthUser | null;
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
    // Only log unexpected errors (session missing is normal for logged-out users)
    if (error.message !== "Auth session missing!") {
      console.error("Token refresh error:", error);
    }
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
