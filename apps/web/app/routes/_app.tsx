/**
 * App Layout Route
 * Wraps all authenticated pages with AppShell (sidebar, top nav, mobile nav)
 */

import { Outlet } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAuth } from "~/lib/auth/require-auth";
import { AppShell } from "~/components/layout/AppShell";

export async function loader(args: LoaderFunctionArgs) {
  // Protect all child routes - require authentication
  const { user, userRecord } = await requireAuth(args);

  return json({
    user,
    userRecord,
  });
}

export default function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
