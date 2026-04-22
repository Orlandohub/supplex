/**
 * App Layout Route
 * Wraps all authenticated pages with AppShell (sidebar, top nav, mobile nav)
 */

import { Outlet, useNavigation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { data as json } from "react-router";
import { requireAuthSecure } from "~/lib/auth/require-auth";
import { AppShell } from "~/components/layout/AppShell";
import { UserRole, PermissionAction, hasPermission } from "@supplex/types";
import { getSupplierForUser } from "~/lib/suppliers.server";
import { sessionStorage } from "~/lib/auth/session.server";

/**
 * AppLoaderData - Root layout loader data
 * Includes server-computed permissions for SSR (prevents flash of unauthorized content)
 */
export type AppLoaderData = {
  user: Awaited<ReturnType<typeof requireAuthSecure>>["user"];
  userRecord: Awaited<ReturnType<typeof requireAuthSecure>>["userRecord"];
  supplierInfo: { id: string; name: string } | null;
  permissions: {
    // Role flags (for quick checks)
    isAdmin: boolean;
    isSupplierUser: boolean;
    isViewer: boolean;
    isProcurementManager: boolean;
    isQualityManager: boolean;

    // Permission flags (for granular checks)
    canManageUsers: boolean;
    canCreateSuppliers: boolean;
    canEditSuppliers: boolean;
    canDeleteSuppliers: boolean;
    canViewAnalytics: boolean;
    canAccessSettings: boolean;
    canCreateQualifications: boolean;
    canUploadDocuments: boolean;
    canDeleteDocuments: boolean;
  };
};

/**
 * Optimize revalidation — the root layout holds user/permissions data which
 * rarely changes mid-session. Avoid re-running the expensive getUser() call
 * on every navigation. The root loader will still run on:
 *   - Initial page load
 *   - Form submissions (POST/PUT/DELETE actions)
 *   - Manual revalidation (e.g. after role change)
 */
export function shouldRevalidate({
  formAction,
  defaultShouldRevalidate: _defaultShouldRevalidate,
}: {
  currentUrl: URL;
  nextUrl: URL;
  defaultShouldRevalidate: boolean;
  formAction?: string;
}) {
  if (formAction) {
    return true;
  }
  return false;
}

export async function loader(args: LoaderFunctionArgs) {
  // Protect all child routes - require authentication
  const { user, userRecord, session } = await requireAuthSecure(args);

  // Fetch supplier info for supplier_user only (with session caching - Quick Win #5)
  const token = session?.access_token;
  let supplierInfo: { id: string; name: string } | null = null;

  try {
    if (!token) {
      throw new Error("No authentication token available");
    }

    // Fetch supplier info only for supplier_user
    if (userRecord && userRecord.role === UserRole.SUPPLIER_USER) {
      // Try to get cached supplierInfo from session (Performance optimization)
      const remixSession = await sessionStorage.getSession(
        args.request.headers.get("Cookie")
      );
      const cachedSupplierInfo = remixSession.get("supplierInfo");

      // Validate cache: check if it's for the same user and not too old
      const cacheTimestamp = remixSession.get("supplierInfoTimestamp");
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
      const isCacheValid =
        cachedSupplierInfo &&
        cachedSupplierInfo.userId === user.id &&
        cacheTimestamp &&
        Date.now() - cacheTimestamp < CACHE_TTL;

      if (isCacheValid) {
        // Return cached supplier info (saves ~50-150ms API call)
        supplierInfo = {
          id: cachedSupplierInfo.id,
          name: cachedSupplierInfo.name,
        };
      } else {
        // Cache miss or expired - fetch from API
        supplierInfo = await getSupplierForUser(user.id, token).catch(
          (error) => {
            console.error("Failed to fetch supplier info:", error);
            throw new Error("Supplier user is not associated with a supplier");
          }
        );

        if (!supplierInfo) {
          throw new Error("Supplier user is not associated with a supplier");
        }

        // Update session cache
        remixSession.set("supplierInfo", { ...supplierInfo, userId: user.id });
        remixSession.set("supplierInfoTimestamp", Date.now());
        // Note: No need to commit session here, as Remix handles it automatically
      }
    }
  } catch (error) {
    console.error("Error in root loader:", error);
    // Re-throw supplier info errors (critical for supplier_user)
    if (
      userRecord &&
      userRecord.role === UserRole.SUPPLIER_USER &&
      error instanceof Error
    ) {
      throw error;
    }
  }

  // Compute permissions server-side (SSR-first pattern - prevents flash of unauthorized content)
  // This is calculated ONCE on the server and sent to client, avoiding client-side recalculation
  const permissions = {
    // Role flags
    isAdmin: userRecord.role === UserRole.ADMIN,
    isSupplierUser: userRecord.role === UserRole.SUPPLIER_USER,
    isViewer: userRecord.role === UserRole.VIEWER,
    isProcurementManager: userRecord.role === UserRole.PROCUREMENT_MANAGER,
    isQualityManager: userRecord.role === UserRole.QUALITY_MANAGER,

    // Permission flags (using permission matrix)
    canManageUsers: hasPermission(
      userRecord.role,
      PermissionAction.MANAGE_USERS
    ),
    canCreateSuppliers: hasPermission(
      userRecord.role,
      PermissionAction.CREATE_SUPPLIERS
    ),
    canEditSuppliers: hasPermission(
      userRecord.role,
      PermissionAction.EDIT_SUPPLIERS
    ),
    canDeleteSuppliers: hasPermission(
      userRecord.role,
      PermissionAction.DELETE_SUPPLIERS
    ),
    canViewAnalytics: hasPermission(
      userRecord.role,
      PermissionAction.VIEW_ANALYTICS
    ),
    canAccessSettings: hasPermission(
      userRecord.role,
      PermissionAction.ACCESS_SETTINGS
    ),
    canCreateQualifications: hasPermission(
      userRecord.role,
      PermissionAction.CREATE_QUALIFICATIONS
    ),
    canUploadDocuments: hasPermission(
      userRecord.role,
      PermissionAction.UPLOAD_DOCUMENTS
    ),
    canDeleteDocuments: hasPermission(
      userRecord.role,
      PermissionAction.DELETE_DOCUMENTS
    ),
  };

  return json({
    user,
    userRecord,
    supplierInfo,
    permissions,
  });
}

function NavigationProgressBar() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      <div className="h-1 w-full bg-blue-100 overflow-hidden">
        <div className="h-full bg-blue-600 animate-progress-bar" />
      </div>
      <style>{`
        @keyframes progress-bar {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 40%; margin-left: 30%; }
          100% { width: 10%; margin-left: 100%; }
        }
        .animate-progress-bar {
          animation: progress-bar 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function AppLayout() {
  return (
    <AppShell>
      <NavigationProgressBar />
      <Outlet />
    </AppShell>
  );
}
