# Quick Reference Card 🚀

Keep this open while coding to avoid common pitfalls.

---

## ⚠️ CRITICAL RULES - Never Break These

### 🎯 Remix Data Loading (See [Remix Patterns](./architecture/remix-patterns.md))
```typescript
// ✅ DO THIS - Fetch in loader
export async function loader(args: LoaderFunctionArgs) {
  const client = createEdenTreatyClient(token);
  
  // Parallel fetching
  const [data1, data2] = await Promise.all([
    client.api.resource1.get(),
    client.api.resource2.get(),
  ]);
  
  return json({ data1, data2, token });
}

// ✅ DO THIS - Props-based components
export function ChildComponent({ data, token }: Props) {
  const revalidator = useRevalidator();
  
  const handleMutation = async () => {
    await mutateData();
    revalidator.revalidate(); // ✅ Triggers loader
  };
}

// ✅ DO THIS - Prevent revalidation on URL state changes
export function shouldRevalidate({ currentUrl, nextUrl }) {
  if (currentUrl.pathname === nextUrl.pathname) {
    if (currentUrl.searchParams.toString() !== nextUrl.searchParams.toString()) {
      return false; // Don't refetch on tab switch
    }
  }
  return true;
}

// ❌ NEVER do this
function Component() {
  useEffect(() => {
    fetchData(); // ❌ Client-side fetching
  }, []);
}
```

---

## ⚠️ CRITICAL RULES - Never Break These (Backend)

### 🔐 Authentication (Backend)
```typescript
// ✅ DO THIS
export const myRoute = new Elysia({ prefix: "/api" })
  .use(authenticate)  // Direct use
  .post("/endpoint", async ({ user, set }) => {
    // Check role INSIDE handler
    if (!user?.role || !allowedRoles.includes(user.role)) {
      set.status = 403;
      return { success: false, error: { message: "Forbidden" } };
    }
  });

// ❌ NEVER DO THIS
.use(requireRole([...])) // Doesn't pass context correctly
```

### 🗄️ Database Queries
```typescript
// ✅ DO THIS - Verify fields exist in schema
const result = await db
  .select({
    main: myTable,
    joined: {
      id: other.id,
      name: other.name,  // Check schema first!
    },
  })
  .leftJoin(other, eq(myTable.fk, other.id));

// Always null-check joined data
const data = result[0].joined?.name || "Unknown";

// ❌ NEVER assume field names without checking schema
```

### 🌐 Environment Variables (Frontend)
```typescript
// ✅ DO THIS - Use centralized config
import { config } from "~/lib/config";
const apiUrl = config.apiUrl;

// ✅ OR - Full 3-source pattern
const isBrowser = typeof window !== "undefined";
const apiUrl = isBrowser 
  ? window.ENV?.API_URL 
  : import.meta.env.API_URL || process.env.API_URL;

// ❌ NEVER use process.env directly in frontend
const apiUrl = process.env.API_URL; // Crashes in browser!

// ❌ NEVER use wrong variable names
const apiUrl = import.meta.env.VITE_API_URL; // Undefined!
```

### 🎯 ElysiaJS Validation Schemas
```typescript
// ✅ DO THIS - TypeBox only
import { UserRole } from "@supplex/types";  // Type only

body: t.Object({
  field: t.String(),
  enum: t.Union([
    t.Literal("value1"),
    t.Literal("value2"),
  ]),
})

// ❌ NEVER mix Zod with TypeBox
import { DocumentTypeSchema } from "@supplex/types";  // Zod schema
body: t.Object({
  documentType: DocumentTypeSchema,  // Crashes!
})
```

---

## 📝 Pre-Commit Checklist

### Before Pushing Code
- [ ] **Remix routes**: Data fetched in loader, not useEffect
- [ ] **Remix routes**: Added `shouldRevalidate` if using URL state (tabs, filters)
- [ ] **Remix routes**: Components receive data via props
- [ ] **Remix routes**: Mutations use `revalidator.revalidate()`
- [ ] All schema field names verified against `packages/db/schema/`
- [ ] No `process.env` usage in frontend code - use `config.apiUrl`
- [ ] Auth middleware used directly, not nested
- [ ] Role checks include null safety: `user?.role`
- [ ] Joined data has null checks: `joined?.field`
- [ ] Client-side navigation tested (not just initial loads)
- [ ] ElysiaJS routes use TypeBox only (no Zod schemas)
- [ ] TypeScript builds without errors: `pnpm build`
- [ ] Tests pass: `pnpm test`

---

## 🔍 Common Errors → Quick Fixes

| Error Message | Fix |
|---------------|-----|
| **Remix Patterns** | |
| Slow tab switching | Add `shouldRevalidate` function to route |
| Data not updating after mutation | Use `revalidator.revalidate()` not manual state update |
| Flash of loading state | Fetch data in loader, not useEffect |
| **Backend** | |
| `user.role is undefined` | Use `authenticate` directly, move role check to handler |
| `process is not defined` | Use `config.apiUrl` or add `typeof window !== "undefined"` check |
| `Object.entries requires...` | Check if schema field actually exists |
| `Cannot create route... parameter` | Use consistent param names (`:id` not `:supplierId`) |
| `POST to /suppliers/undefined/api/...` | Use `config.apiUrl` not `import.meta.env.VITE_API_URL` |
| `Preflight validation check failed` | ElysiaJS routes must use TypeBox (`t.*`), not Zod (`z.*`) |

---

## 📚 Full Documentation

- **Coding Standards**: `docs/architecture/coding-standards.md`
- **Known Issues**: `docs/troubleshooting/known-issues-and-fixes.md`
- **Tech Stack**: `docs/architecture/tech-stack.md`

---

## 🚨 When in Doubt

1. **Check the schema** before writing queries
2. **Test navigation** between pages, not just initial loads
3. **Verify auth logs** appear in console for protected routes
4. **Read error messages carefully** - they usually tell you what's wrong

---

**Last Updated**: October 23, 2025

