# Role-Based Access Control (RBAC) - Frontend Guide

This directory contains all frontend utilities for implementing role-based access control in the Supplex application.

## Available Roles

```typescript
enum UserRole {
  ADMIN = "admin",
  PROCUREMENT_MANAGER = "procurement_manager",
  QUALITY_MANAGER = "quality_manager",
  VIEWER = "viewer",
}
```

## Quick Start

### 1. Using the `usePermissions` Hook

The easiest way to check permissions in your components:

```tsx
import { usePermissions } from '~/hooks/usePermissions';

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

### 2. Using the `RoleGuard` Component

For conditional rendering based on roles:

```tsx
import { RoleGuard, AdminOnly, NonViewerOnly } from '~/lib/rbac/RoleGuard';
import { UserRole } from '@supplex/types';

function SupplierPage() {
  return (
    <>
      <h1>Supplier Details</h1>
      
      {/* Only admins and procurement managers can edit */}
      <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER]}>
        <EditSupplierButton />
      </RoleGuard>

      {/* Admin only shorthand */}
      <AdminOnly>
        <DeleteSupplierButton />
      </AdminOnly>

      {/* Everyone except viewers */}
      <NonViewerOnly>
        <CreateButton />
      </NonViewerOnly>
    </>
  );
}
```

### 3. Protecting Routes

Route protection is handled server-side via Remix loaders. The `_app.tsx` layout
loader calls `requireAuthSecure()` which validates the session and fetches the
`userRecord`. Child loaders use `requireAuth()` (fast, local JWT parse). For
role-based restrictions, use `requireRole()` from `~/lib/auth/require-auth`:

```tsx
import { requireRole } from '~/lib/auth/require-auth';
import { UserRole } from '@supplex/types';

export async function loader(args: LoaderFunctionArgs) {
  const { user, userRecord } = await requireRole(args.request, UserRole.ADMIN);
  // ... admin-only loader logic
}
```

### 4. Role-Based Navigation

Use the permissions to filter navigation items:

```tsx
import { usePermissions } from '~/hooks/usePermissions';

function Navigation() {
  const permissions = usePermissions();

  const navItems = [
    { name: 'Dashboard', href: '/', show: true },
    { name: 'Suppliers', href: '/suppliers', show: true },
    { name: 'Settings', href: '/settings', show: permissions.canAccessSettings },
  ].filter(item => item.show);

  return (
    <nav>
      {navItems.map(item => (
        <Link key={item.href} to={item.href}>{item.name}</Link>
      ))}
    </nav>
  );
}
```

## Available Permission Checks

The `usePermissions()` hook returns an object with these boolean flags:

```typescript
interface Permissions {
  // User Management
  canManageUsers: boolean;           // Admin only
  
  // Supplier Management
  canViewSuppliers: boolean;         // All authenticated users
  canCreateSuppliers: boolean;       // Admin, Procurement Manager
  canEditSupplier: boolean;          // Admin, Procurement Manager
  canDeleteSuppliers: boolean;       // Admin, Procurement Manager
  
  // Document Management
  canUploadDocuments: boolean;       // Admin, Procurement Manager, Quality Manager
  
  // Evaluation Management
  canCreateEvaluations: boolean;     // Admin, Quality Manager
  
  // CAPA Management
  canManageCapa: boolean;            // Admin, Quality Manager
  
  // Analytics
  canViewAnalytics: boolean;         // All authenticated users
  
  // Settings
  canAccessSettings: boolean;        // Admin only
  
  // Role Checks
  isAdmin: boolean;
  isViewer: boolean;
}
```

## Direct Permission Functions

If you need to check permissions outside of React components:

```typescript
import { 
  canManageUsers, 
  canEditSupplier, 
  isAdmin 
} from '~/lib/rbac/permissions';
import { UserRole } from '@supplex/types';

const user = { role: UserRole.ADMIN, /* ... */ };

if (canManageUsers(user)) {
  // Do admin stuff
}

if (canEditSupplier(user)) {
  // Allow editing
}
```

## Permission Matrix

| Action | Admin | Procurement Manager | Quality Manager | Viewer |
|--------|-------|-------------------|-----------------|--------|
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Edit Suppliers | ✅ | ✅ | ❌ | ❌ |
| Create Evaluations | ✅ | ❌ | ✅ | ❌ |
| Manage CAPA | ✅ | ❌ | ✅ | ❌ |
| Upload Documents | ✅ | ✅ | ✅ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ✅ |
| Access Settings | ✅ | ❌ | ❌ | ❌ |

## Best Practices

1. **Always check permissions on both frontend AND backend** - Frontend checks are for UX only
2. **Use the `usePermissions` hook** - It's the most maintainable approach
3. **Provide fallback UI** - Show helpful messages when users lack permissions
4. **Test all role variations** - Ensure UI renders correctly for each role
5. **Keep permission logic DRY** - Reuse permission functions across components

## Examples

### Hide Edit Button for Viewers

```tsx
function SupplierCard({ supplier }) {
  const permissions = usePermissions();

  return (
    <div className="card">
      <h3>{supplier.name}</h3>
      {permissions.canEditSupplier && (
        <button onClick={() => editSupplier(supplier)}>Edit</button>
      )}
    </div>
  );
}
```

### Different Actions Based on Role

```tsx
function EvaluationActions({ evaluation }) {
  const permissions = usePermissions();

  return (
    <div>
      {permissions.canCreateEvaluations && (
        <button>Create Evaluation</button>
      )}
      {permissions.isAdmin && (
        <button>Delete Evaluation</button>
      )}
      {permissions.isViewer && (
        <p>You can only view evaluations</p>
      )}
    </div>
  );
}
```

### Conditional Form Fields

```tsx
function SupplierForm() {
  const permissions = usePermissions();

  return (
    <form>
      <input name="name" disabled={!permissions.canEditSupplier} />
      <input name="email" disabled={!permissions.canEditSupplier} />
      
      {permissions.isAdmin && (
        <select name="risk_level">
          <option>Low</option>
          <option>High</option>
        </select>
      )}
      
      {permissions.canEditSupplier ? (
        <button type="submit">Save</button>
      ) : (
        <p className="text-gray-500">You don't have permission to edit</p>
      )}
    </form>
  );
}
```

## Troubleshooting

**Q: Permission checks always return false**
- Check that the user is authenticated
- Verify the user's role is correctly set in the auth context
- Check browser console for any errors

**Q: UI shows edit button but API returns 403**
- This is expected! Frontend checks are for UX only
- Backend always validates permissions
- Add better error handling in your API calls

**Q: Role updates don't reflect immediately**
- User may need to refresh their JWT token
- Consider forcing a logout/login after role change
- Or implement token refresh in the background

