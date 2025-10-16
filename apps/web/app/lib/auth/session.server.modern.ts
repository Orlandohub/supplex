/**
 * Modern Supabase Server-Side Authentication for Remix
 * Using @supabase/ssr instead of deprecated auth-helpers
 */

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCookieSessionStorage, redirect } from '@remix-run/node';
import type { Database } from '@supplex/types';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const sessionSecret = process.env.SESSION_SECRET!;

if (!supabaseUrl || !supabaseAnonKey || !sessionSecret) {
  throw new Error('Missing required environment variables for authentication');
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
 * Create a Supabase server client for server-side operations (Modern approach)
 */
export function createSupabaseServerClient(
  request: Request,
  response: Response = new Response()
): SupabaseClient<Database> {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const cookieHeader = request.headers.get('Cookie');
        if (!cookieHeader) return undefined;
        
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map(cookie => {
            const [name, ...rest] = cookie.split('=');
            return [name, rest.join('=')];
          })
        );
        
        return cookies[name];
      },
      set(name: string, value: string, options: any) {
        const cookie = `${name}=${value}; ${Object.entries(options)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => {
            if (k === 'maxAge') return `Max-Age=${v}`;
            if (k === 'httpOnly') return v ? 'HttpOnly' : '';
            if (k === 'secure') return v ? 'Secure' : '';
            if (k === 'sameSite') return `SameSite=${v}`;
            return `${k}=${v}`;
          })
          .filter(Boolean)
          .join('; ')}`;
        
        response.headers.append('Set-Cookie', cookie);
      },
      remove(name: string, options: any) {
        this.set(name, '', { ...options, maxAge: 0 });
      },
    },
  });
}

// Export all the same functions as the original file
export async function getSession(request: Request) {
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

export async function requireAuth(request: Request) {
  const { session, user, supabase, response } = await getSession(request);
  
  if (!session || !user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    const loginUrl = `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
    throw redirect(loginUrl);
  }

  return { user, session, supabase, response };
}

export async function getAuthenticatedUser(request: Request) {
  const { user, session, supabase, response } = await requireAuth(request);
  
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

export async function signOut(request: Request) {
  const { supabase, response } = await getSession(request);
  
  await supabase.auth.signOut();
  
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

export async function refreshTokens(request: Request) {
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

export function getAuthHeaders(response: Response): HeadersInit {
  return Array.from(response.headers.entries());
}
