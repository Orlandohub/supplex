/**
 * Settings Index Route
 * Landing page for settings section with overview of all settings areas
 */

import type { LoaderFunctionArgs } from "react-router";
import { data as json } from "react-router";
import { useLoaderData } from "react-router";
import { requireRole } from "~/lib/auth/require-auth";
import { UserRole } from "@supplex/types";
import { SettingsOverview } from "~/components/settings/SettingsOverview";

export async function loader({ request }: LoaderFunctionArgs) {
  const { userRecord } = await requireRole(request, UserRole.ADMIN);

  return json({
    user: userRecord,
  });
}

export default function SettingsIndex() {
  const { user } = useLoaderData<typeof loader>();

  return <SettingsOverview user={user} />;
}
