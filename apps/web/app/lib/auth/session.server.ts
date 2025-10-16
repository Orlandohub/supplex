import { createServerClient } from '@supabase/auth-helpers-remix';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCookieSessionStorage, redirect } from '@remix-run/node';
import type { Database } from '@supplex/types';

// Environment variables with development defaults
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
const sessionSecret = process.env.SESSION_SECRET || 'dev-session-secret-change-in-production';

// Only validate in production or when explicitly set
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SESSION_SECRET) {
    throw new Error('Missing required environment variables for authentication in production');
  }
}

// Create session storage for Remix cookies
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__supplex_session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === 'production',
  },
});

/**
 * Create a Supabase server client for server-side operations
 */
export function createSupabaseServerClient(
  request: Request,
  response: Response = new Response()
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    request,
    response,
  });
}

/**
 * Get the current user session from the request
 */
export async function getSession(request: Request): Promise<{
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
  } = await supabase.auth.getSession();

  if (error) {
    console.error('Session error:', error);
  }

  return {
    session,
    user: session?.user ?? null,
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
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user record:', error);
    throw new Error('Failed to fetch user data');
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
    request.headers.get('Cookie')
  );
  
  return redirect('/login', {
    headers: [
      ...Array.from(response.headers.entries()),
      ['Set-Cookie', await sessionStorage.destroySession(session)],
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
    console.error('Token refresh error:', error);
    throw redirect('/login');
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
