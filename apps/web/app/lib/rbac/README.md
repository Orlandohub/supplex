# Frontend RBAC Guide

This directory contains the frontend role and permission helpers used by the Supplex web app.

Use this guide for local RBAC usage patterns. Use the shared docs for broader contributor guidance:

- [`../../../../../docs/README.md`](../../../../../docs/README.md)
- [`../../../../../docs/standards.md`](../../../../../docs/standards.md)
- [`../../../../../docs/frontend.md`](../../../../../docs/frontend.md)

## Roles In Use

Current roles from `@supplex/types`:

- `admin`
- `procurement_manager`
- `quality_manager`
- `viewer`
- `supplier_user`

## Preferred Pattern

For route-rendered UI, prefer SSR-first permissions from the parent `_app` loader instead of relying only on client hooks. That avoids flash of unauthorized content and keeps route-level access decisions aligned with the server response.

Use the hook for client-only behavior such as dialogs, event handlers, or progressively migrated components.

## Reading Permissions In Route UI

```tsx
import { useRouteLoaderData } from "@remix-run/react";
import type { AppLoaderData } from "~/routes/_app";

function SupplierActions() {
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
  const permissions = appData?.permissions;

  return (
    <>
      {permissions?.canEditSuppliers && <EditSupplierButton />}
    </>
  );
}
```

## Using `usePermissions()`

For client-side permission checks:

```tsx
import { usePermissions } from "~/hooks/usePermissions";

function MyComponent() {
  const permissions = usePermissions();

  return (
    <>
      {permissions.canEditSupplier && <EditButton />}
      {permissions.canManageUsers && <UserManagementLink />}
      {permissions.isAdmin && <AdminPanel />}
    </>
  );
}
```

The hook currently exposes these flags:

- `canManageUsers`
- `canViewSuppliers`
- `canCreateSuppliers`
- `canEditSupplier`
- `canDeleteSuppliers`
- `canUploadDocument`
- `canDeleteDocument`
- `canCreateEvaluations`
- `canManageCapa`
- `canViewAnalytics`
- `canAccessSettings`
- `isAdmin`
- `isViewer`
- `isSupplierUser`

## Using `RoleGuard`

For explicit role-gated rendering:

```tsx
import { RoleGuard, AdminOnly, NonViewerOnly } from "~/lib/rbac/RoleGuard";
import { UserRole } from "@supplex/types";

function SupplierPage() {
  return (
    <>
      <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER]}>
        <EditSupplierButton />
      </RoleGuard>

      <AdminOnly>
        <DeleteSupplierButton />
      </AdminOnly>

      <NonViewerOnly>
        <CreateButton />
      </NonViewerOnly>
    </>
  );
}
```

## Protecting Routes

Route protection is handled server-side in Remix loaders.

- Use `requireAuthSecure()` once in the root `_app.tsx` loader
- Use `requireAuth()` in child loaders when authentication is required
- Use `requireRole()` for role-restricted routes

```tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireRole } from "~/lib/auth/require-auth";
import { UserRole } from "@supplex/types";

export async function loader(args: LoaderFunctionArgs) {
  const { userRecord } = await requireRole(args.request, UserRole.ADMIN);
  return { email: userRecord.email };
}
```

## Source Of Truth

For the current permission behavior, prefer the live code over duplicated tables:

- `apps/web/app/hooks/usePermissions.ts`
- `apps/web/app/lib/rbac/permissions.ts`
- `apps/web/app/lib/rbac/RoleGuard.tsx`
- `packages/types/src/models/permissions.ts`
- `packages/types/src/models/user.ts`
