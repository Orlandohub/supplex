import type { ReactNode } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { data as json } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import type { LinksFunction } from "react-router";
import { AuthProvider } from "~/providers/AuthProvider";
import { getSessionFast } from "~/lib/auth/session.server";
import { getSecurityHeaders } from "~/lib/security/csp";
import { Toaster } from "~/components/ui/toaster";
import styles from "./tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  // Preconnect to Supabase for better performance
  { rel: "preconnect", href: "https://supabase.co" },
  { rel: "dns-prefetch", href: "https://supabase.co" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  // Local session parse only — no network call to Supabase Auth.
  // Full auth validation happens once in the _app.tsx loader (requireAuthSecure).
  const { session, user, response } = await getSessionFast(request);

  const authHeaders = response
    ? Object.fromEntries(response.headers.entries())
    : {};
  const securityHeaders = getSecurityHeaders(
    process.env.NODE_ENV === "development"
  );

  return json(
    {
      user: user || null,
      session: session || null,
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
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { user, session, env } = useLoaderData<typeof loader>();

  return (
    <AuthProvider initialUser={user} initialSession={session}>
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
