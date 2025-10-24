# Code Templates

This directory contains reusable code templates for common patterns in the Supplex application.

## Available Templates

### 1. Remix Route Template

**File**: `remix-route-template.tsx`

**When to use**: Creating any new page/route in the application

**How to use**:
1. Copy `remix-route-template.tsx` to `apps/web/app/routes/your-route.tsx`
2. Replace placeholders with your actual implementation:
   - Change `YourType` to your actual type
   - Update API endpoints (`client.api.resource...`)
   - Customize component rendering
   - Update meta tags for SEO
3. Follow the checklist at the bottom of the template
4. Delete comments and unused sections

**What's included**:
- ✅ Loader function with parallel data fetching
- ✅ `shouldRevalidate` function (comment out if not needed)
- ✅ Action function for mutations (optional)
- ✅ Component using loader data
- ✅ Example child component with revalidation
- ✅ Meta function for SEO
- ✅ Error boundary
- ✅ Checklist for verification

**Reference**: See `docs/architecture/remix-patterns.md` for detailed explanations

---

## Template Usage Guidelines

### Before Using a Template

1. **Read the documentation** referenced in the template
2. **Understand the patterns** - don't just copy/paste
3. **Check existing similar routes** for reference

### While Using a Template

1. **Keep the structure** - loader → shouldRevalidate → action → component → meta → error boundary
2. **Delete unused code** - if you don't need actions, remove them
3. **Update TypeScript types** - replace all generic types with your actual types
4. **Follow the checklist** - verify each item before considering done

### After Using a Template

1. **Test thoroughly** - use the checklist as a guide
2. **Remove template comments** - clean up before committing
3. **Verify no unnecessary revalidation** - check network tab for unnecessary calls
4. **Check auth logs** - ensure no auth calls on URL-only changes

---

## Common Mistakes When Using Templates

### ❌ 1. Forgetting to add `shouldRevalidate`
```typescript
// If your route has URL state (tabs, filters), you NEED this
export function shouldRevalidate(...) { ... }
```

### ❌ 2. Fetching data in components instead of loader
```typescript
// ❌ WRONG
function Component() {
  useEffect(() => {
    fetchData();
  }, []);
}

// ✅ CORRECT
export async function loader() {
  const data = await fetchData();
  return json({ data });
}
```

### ❌ 3. Not using Promise.all for parallel requests
```typescript
// ❌ WRONG - Sequential (slow)
const data1 = await fetch1();
const data2 = await fetch2();

// ✅ CORRECT - Parallel (fast)
const [data1, data2] = await Promise.all([fetch1(), fetch2()]);
```

### ❌ 4. Manual state updates after mutations
```typescript
// ❌ WRONG
await deleteItem(id);
setItems(items.filter(i => i.id !== id));

// ✅ CORRECT
await deleteItem(id);
revalidator.revalidate();
```

### ❌ 5. Leaving placeholder types
```typescript
// ❌ WRONG
type YourType // Still using placeholder

// ✅ CORRECT
import type { Product } from "@supplex/types";
```

---

## Template Maintenance

When updating templates:

1. **Update all templates** if patterns change
2. **Document changes** in template comments
3. **Notify team** of breaking pattern changes
4. **Update examples** in documentation

---

## Getting Help

- **Detailed patterns**: `docs/architecture/remix-patterns.md`
- **Quick reference**: `docs/QUICK-REFERENCE.md`
- **Working example**: `apps/web/app/routes/suppliers.$id.tsx`
- **Troubleshooting**: `docs/troubleshooting/known-issues-and-fixes.md`

---

**Last Updated**: October 23, 2025  
**Maintained By**: Dev Team

