import type { ReactNode } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { AuthProvider } from "~/providers/AuthProvider";
import { getSession } from "~/lib/auth/session.server";
import { getSecurityHeaders } from "~/lib/security/csp";
import styles from "./tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  // Preconnect to Supabase for better performance
  { rel: "preconnect", href: "https://supabase.co" },
  { rel: "dns-prefetch", href: "https://supabase.co" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  // Get initial authentication state for the app
  const { session, user, response } = await getSession(request);
  
  const userRecord = null;
  
  // If user is authenticated, fetch their user record
  if (user && session) {
    try {
      const { createSupabaseServerClient } = await import("~/lib/auth/session.server");
      // TODO: Use createSupabaseServerClient when we implement server-side user record fetching
      
      // For now, we'll pass the user data and let the client fetch the user record
      // This avoids server-side database calls during initial load
    } catch (error) {
      console.error("Error fetching user record in root loader:", error);
    }
  }

  // Combine auth headers with security headers
  const authHeaders = response ? Object.fromEntries(response.headers.entries()) : {};
  const securityHeaders = getSecurityHeaders(process.env.NODE_ENV === 'development');

  return json(
    {
      user: user || null,
      session: session || null,
      userRecord,
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        API_URL: process.env.API_URL || `http://localhost:3001`,
      },
    },
    {
      headers: {
        ...authHeaders,
        ...securityHeaders,
      },
    }
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <Meta />
        <Links />
      </head>
      <body className="antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { user, session, userRecord, env } = useLoaderData<typeof loader>();

  return (
    <AuthProvider
      initialUser={user}
      initialSession={session}
      initialUserRecord={userRecord}
    >
      {/* Make environment variables available to the client */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.ENV = ${JSON.stringify(env)};`,
        }}
      />
      <Outlet />
    </AuthProvider>
  );
}
