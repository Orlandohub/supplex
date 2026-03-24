# Remix Routing Conventions

**Version**: 1.0  
**Date**: December 17, 2025  
**Status**: **CRITICAL REFERENCE** - Read before creating new routes

> ⚠️ **IMPORTANT:** Improper route naming can cause routes to not render. See [Issue 9](../troubleshooting/known-issues-and-fixes.md#issue-9-remix-route-nesting---edit-route-not-rendering-child-route-without-outlet) for a real example.

---

## Table of Contents

1. [Flat File Routing Overview](#flat-file-routing-overview)
2. [Sibling vs Child Routes](#sibling-vs-child-routes)
3. [Common Patterns](#common-patterns)
4. [Route Naming Checklist](#route-naming-checklist)
5. [Common Mistakes](#common-mistakes)

---

## Flat File Routing Overview

Remix v2 uses flat file routing where the **filename determines the URL structure and route hierarchy**.

### Key Convention: The Trailing Underscore

The **trailing underscore** (`_`) is critical for controlling route relationships:

| Pattern | Creates | Example |
|---------|---------|---------|
| `$id.edit` | **Child route** (nests under `$id`) | ❌ Requires parent to have `<Outlet />` |
| `$id_.edit` | **Sibling route** (same level as `$id`) | ✅ Independent, no Outlet needed |

---

## Sibling vs Child Routes

### Sibling Routes (Independent Pages)

**When to use:** Pages that should render completely different content.

**Naming pattern:** Use trailing underscore `$param_.segment`

**Example:**
```
apps/web/app/routes/
  _app.suppliers.$id.tsx         → /suppliers/:id (detail page)
  _app.suppliers.$id_.edit.tsx   → /suppliers/:id/edit (edit page)
```

**Result:**
- ✅ Detail and edit pages are **independent**
- ✅ No `<Outlet />` required
- ✅ Navigation shows completely different content
- ✅ Each route controls its own layout

**Code Example:**
```typescript
// _app.suppliers.$id.tsx (detail route)
export default function SupplierDetail() {
  const { supplier } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <h1>{supplier.name}</h1>
      <SupplierDetailTabs supplier={supplier} />
      {/* No <Outlet /> needed */}
    </div>
  );
}

// _app.suppliers.$id_.edit.tsx (sibling edit route)
export default function SupplierEdit() {
  const { supplier } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <h1>Edit {supplier.name}</h1>
      <SupplierForm mode="edit" supplier={supplier} />
    </div>
  );
}
```

---

### Child Routes (Shared Layout)

**When to use:** Pages that share a parent's layout/header/navigation.

**Naming pattern:** Use regular dot notation `$param.segment` (no trailing underscore)

**Example:**
```
apps/web/app/routes/
  _app.settings.tsx              → /settings (parent with shared layout)
  _app.settings.profile.tsx      → /settings/profile (child)
  _app.settings.security.tsx     → /settings/security (child)
```

**Result:**
- ✅ Children render **inside** parent's `<Outlet />`
- ✅ Share parent's layout, header, navigation
- ⚠️ Parent **MUST** have `<Outlet />` component

**Code Example:**
```typescript
// _app.settings.tsx (parent route with shared layout)
export default function SettingsLayout() {
  return (
    <div>
      <SettingsHeader />
      <SettingsSidebar />
      <div className="content">
        <Outlet /> {/* ← REQUIRED for child routes */}
      </div>
    </div>
  );
}

// _app.settings.profile.tsx (child route)
export default function SettingsProfile() {
  return <div>Profile settings form...</div>;
}
```

---

## Common Patterns

### Pattern 1: Resource Detail + Edit (Sibling Routes)

**Use Case:** Detail view and edit form are completely different pages.

**Route Files:**
```
_app.resources.$id.tsx          → /resources/:id (detail)
_app.resources.$id_.edit.tsx    → /resources/:id/edit (edit)
```

**When to use:**
- ✅ Detail page shows read-only information
- ✅ Edit page shows full form
- ✅ No shared layout between detail and edit

**Example Resources:**
- Suppliers (`/suppliers/:id` and `/suppliers/:id/edit`)
- Workflows (`/workflows/:id` and `/workflows/:id/edit`)
- Evaluations (`/evaluations/:id` and `/evaluations/:id/edit`)

---

### Pattern 2: Settings with Tabs (Child Routes)

**Use Case:** Multiple settings pages sharing common header/navigation.

**Route Files:**
```
_app.settings.tsx               → /settings (layout with Outlet)
_app.settings._index.tsx        → /settings (default tab)
_app.settings.profile.tsx       → /settings/profile
_app.settings.security.tsx      → /settings/security
_app.settings.notifications.tsx → /settings/notifications
```

**When to use:**
- ✅ All pages share header/sidebar/navigation
- ✅ Tab-like navigation between sections
- ✅ Common layout wraps all children

---

### Pattern 3: Multi-Step Form (Child Routes)

**Use Case:** Wizard with shared progress indicator.

**Route Files:**
```
_app.onboarding.tsx             → /onboarding (wizard layout)
_app.onboarding.step-1.tsx      → /onboarding/step-1
_app.onboarding.step-2.tsx      → /onboarding/step-2
_app.onboarding.step-3.tsx      → /onboarding/step-3
```

**When to use:**
- ✅ Multi-step process with shared UI
- ✅ Progress indicator shown on all steps
- ✅ Common layout (stepper, navigation buttons)

---

## Route Naming Checklist

Before creating a new route file, answer these questions:

### Question 1: Should this page share the parent's layout?

**YES → Use Child Route (no trailing underscore)**
```
_app.parent.child.tsx
```
- ⚠️ **REMEMBER:** Add `<Outlet />` to parent route
- Parent and child render together
- Child appears inside parent's layout

**NO → Use Sibling Route (trailing underscore)**
```
_app.parent_.child.tsx
```
- ✅ Routes are independent
- No `<Outlet />` needed
- Completely different content

---

### Question 2: Is this an edit page for a resource?

**YES → Use Sibling Route**
```
_app.resources.$id.tsx          (detail)
_app.resources.$id_.edit.tsx    (edit)
```
- Edit pages rarely share layout with detail pages
- Users expect completely different UI

---

### Question 3: Will the parent have an `<Outlet />` component?

**YES → Child route is OK**
```typescript
// Parent
export default function Parent() {
  return (
    <div>
      <Header />
      <Outlet /> {/* ← Child renders here */}
    </div>
  );
}
```

**NO or UNSURE → Use Sibling Route**
```
Use trailing underscore: $id_.segment
```

---

## Common Mistakes

### ❌ Mistake 1: Child Route Without Outlet

**Problem:**
```
// File: _app.suppliers.$id.edit.tsx (child route)
// Parent: _app.suppliers.$id.tsx (has NO Outlet)
```

**Symptoms:**
- ✅ URL changes to `/suppliers/:id/edit`
- ❌ Edit page doesn't render (shows detail page instead)
- ❌ No JavaScript errors
- ❌ Same component as detail page visible

**Fix:**
```
Rename: _app.suppliers.$id_.edit.tsx (add trailing underscore)
```

**Real Example:** See [Issue 9](../troubleshooting/known-issues-and-fixes.md#issue-9-remix-route-nesting---edit-route-not-rendering-child-route-without-outlet)

---

### ❌ Mistake 2: Using Sibling Route for Tabs

**Problem:**
```
// Settings tabs as siblings (wrong)
_app.settings.tsx              → /settings
_app.settings_.profile.tsx     → /settings/profile (sibling)
_app.settings_.security.tsx    → /settings/security (sibling)
```

**Issue:**
- Each tab reloads entire layout
- Can't share header/navigation state
- Inefficient rendering

**Fix:**
```
// Settings tabs as children (correct)
_app.settings.tsx              → /settings (has <Outlet />)
_app.settings.profile.tsx      → /settings/profile (child)
_app.settings.security.tsx     → /settings/security (child)
```

---

### ❌ Mistake 3: Forgetting Outlet in Parent

**Problem:**
```typescript
// Parent route (missing Outlet)
export default function Parent() {
  return <div>Parent content</div>; // ← No Outlet!
}

// Child route (never renders)
export default function Child() {
  return <div>Child content</div>;
}
```

**Fix:**
```typescript
// Add Outlet to parent
export default function Parent() {
  return (
    <div>
      Parent content
      <Outlet /> {/* ← Add this */}
    </div>
  );
}
```

---

## Testing Your Routes

After creating a new route, verify:

### For Sibling Routes (detail/edit pattern):
1. ✅ Navigate to detail page → shows detail content
2. ✅ Click edit button → URL changes to `/resource/:id/edit`
3. ✅ Edit page shows **completely different** content (form, not detail view)
4. ✅ No need to check for `<Outlet />` in detail route

### For Child Routes (tabs/wizard pattern):
1. ✅ Parent route has `<Outlet />` component
2. ✅ Navigate to parent → shows layout with child content
3. ✅ Navigate to different child → layout stays, content changes
4. ✅ Shared UI (header, sidebar) doesn't reload

---

## Quick Reference

| Use Case | Pattern | Example |
|----------|---------|---------|
| Detail + Edit pages | Sibling | `$id.tsx` + `$id_.edit.tsx` |
| Settings tabs | Child | `settings.tsx` (Outlet) + `settings.tab.tsx` |
| Multi-step wizard | Child | `wizard.tsx` (Outlet) + `wizard.step-1.tsx` |
| Resource CRUD pages | Sibling | `resource.tsx`, `resource_.new.tsx`, `$id_.edit.tsx` |
| Dashboard sections | Child | `dashboard.tsx` (Outlet) + `dashboard.section.tsx` |

---

## Related Documentation

- [Known Issues - Issue 9: Route Nesting](../troubleshooting/known-issues-and-fixes.md#issue-9-remix-route-nesting---edit-route-not-rendering-child-route-without-outlet)
- [Remix Patterns](./remix-patterns.md) - Data loading and component patterns
- [Remix Official Docs: Route File Naming](https://remix.run/docs/en/main/file-conventions/routes)

---

**Remember:** When in doubt, use sibling routes (`$id_.segment`). It's safer to have independent routes than to accidentally create a child route without an Outlet.






