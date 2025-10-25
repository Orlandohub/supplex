/**
 * App Layout Route
 * Wraps all authenticated pages with AppShell (sidebar, top nav, mobile nav)
 */

import { Outlet } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { AppShell } from "~/components/layout/AppShell";

export async function loader(args: LoaderFunctionArgs) {
  // Protect all child routes - require authentication
  const { user, userRecord, session } = await requireAuth(args);

  // Fetch task count for badge
  let taskCount = 0;
  try {
    const token = session?.access_token;
    if (token) {
      const client = createEdenTreatyClient(token);
      const response = await client.api.workflows["my-tasks"]["count"].get();

      if (!response.error && response.data) {
        const apiResponse = response.data as {
          success: boolean;
          data: { count: number };
        };
        taskCount = apiResponse.data.count;
      }
    }
  } catch (error) {
    console.error("Failed to fetch task count:", error);
    // Continue without task count - don't fail the whole page
  }

  return json({
    user,
    userRecord,
    taskCount,
  });
}

export default function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
