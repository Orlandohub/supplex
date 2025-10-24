# Remix Patterns & Best Practices

**Version**: 1.0  
**Date**: October 23, 2025  
**Status**: Approved for System-Wide Use

This document defines the standard patterns for implementing Remix routes in the Supplex application.

---

## Table of Contents

1. [Server-Side Data Loading](#server-side-data-loading)
2. [Props-Based Component Architecture](#props-based-component-architecture)
3. [Preventing Unnecessary Revalidation](#preventing-unnecessary-revalidation)
4. [Mutations with Revalidation](#mutations-with-revalidation)
5. [URL-Based State Management](#url-based-state-management)
6. [Complete Example](#complete-example)

---

## Server-Side Data Loading

### ✅ DO: Fetch All Data in Loaders

**Pattern:**
```typescript
export async function loader(args: LoaderFunctionArgs) {
  // 1. Authentication
  const { session } = await requireAuth(args);
  
  // 2. Get params
  const { id } = args.params;
  if (!id) throw new Response("ID required", { status: 400 });
  
  // 3. Create API client
  const token = session?.access_token;
  if (!token) throw new Response("Unauthorized", { status: 401 });
  const client = createEdenTreatyClient(token);
  
  // 4. Fetch data in parallel (if multiple sources)
  const [primaryData, secondaryData] = await Promise.all([
    client.api.resource[id].get(),
    client.api.resource[id].related.get(),
  ]);
  
  // 5. Error handling
  if (primaryData.error) {
    throw new Response("Not found", { status: 404 });
  }
  
  // 6. Return all data
  return json({
    primary: primaryData.data,
    secondary: secondaryData.data || [],
    token, // For client-side mutations
  });
}
```

**Why:**
- ✅ Server-side rendering (SEO, fast initial load)
- ✅ Parallel data fetching (no waterfalls)
- ✅ Type-safe end-to-end
- ✅ No loading states needed

### ❌ DON'T: Fetch Data in useEffect

**Anti-pattern:**
```typescript
// ❌ WRONG
export default function Component() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData(); // Client-side fetching
  }, []);
}
```

**Why it's wrong:**
- ❌ No SSR (bad for SEO)
- ❌ Loading waterfalls
- ❌ Flash of loading state
- ❌ Complicated state management

---

## Props-Based Component Architecture

### ✅ DO: Pass Data via Props

**Pattern:**
```typescript
// Route component
export default function ResourceDetail() {
  const { resource, relatedData, token } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <ResourceOverview resource={resource} />
      <RelatedDataTab data={relatedData} token={token} />
    </div>
  );
}

// Child component
interface RelatedDataTabProps {
  data: RelatedItem[];
  token: string;
}

export function RelatedDataTab({ data, token }: RelatedDataTabProps) {
  // Data is already here, no fetching needed
  // Use revalidator for mutations only
  const revalidator = useRevalidator();
  
  return <div>{/* Render data */}</div>;
}
```

**Why:**
- ✅ Data ready on render (no loading)
- ✅ Simple props flow
- ✅ Easy to test
- ✅ Type-safe

### ❌ DON'T: Fetch in Child Components

**Anti-pattern:**
```typescript
// ❌ WRONG
export function RelatedDataTab({ resourceId }: Props) {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    fetchRelatedData(resourceId); // Fetching in child
  }, [resourceId]);
}
```

---

## Preventing Unnecessary Revalidation

### ✅ DO: Add shouldRevalidate for URL-Based State

**Pattern:**
```typescript
/**
 * Prevent revalidation on search param changes (e.g., tab switches, filters)
 * Only revalidate on actual route changes or explicit actions
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: {
  currentUrl: URL;
  nextUrl: URL;
  defaultShouldRevalidate: boolean;
}) {
  // Same path, different search params = don't revalidate
  if (currentUrl.pathname === nextUrl.pathname) {
    const currentParams = currentUrl.searchParams.toString();
    const nextParams = nextUrl.searchParams.toString();
    
    if (currentParams !== nextParams) {
      return false; // ✅ No revalidation needed
    }
  }
  
  // Route change or action = use default behavior
  return defaultShouldRevalidate;
}
```

**When to use:**
- ✅ Routes with tabs (search param: `?tab=X`)
- ✅ Routes with filters (search param: `?status=X&category=Y`)
- ✅ Routes with sorting (search param: `?sort=name_asc`)
- ✅ Routes with pagination handled client-side

**When NOT to use:**
- ❌ Server-side pagination (needs fresh data)
- ❌ Routes without URL state
- ❌ Simple routes with no params

### ❌ DON'T: Skip shouldRevalidate When Needed

**Problem:**
```typescript
// ❌ Missing shouldRevalidate
// Every tab switch = full page reload = slow
```

**Result:**
- ❌ Unnecessary API calls on tab switch
- ❌ Auth middleware runs unnecessarily
- ❌ Slow perceived performance
- ❌ Wasted server resources

---

## Mutations with Revalidation

### ✅ DO: Use Revalidator for Updates

**Pattern:**
```typescript
export function DataTable({ data, token }: Props) {
  const revalidator = useRevalidator();
  const { toast } = useToast();
  
  const handleDelete = async (id: string) => {
    try {
      const client = createEdenTreatyClient(token);
      const response = await client.api.resource[id].delete();
      
      if (response.error) {
        throw new Error("Delete failed");
      }
      
      toast({ title: "Deleted successfully" });
      
      // ✅ Trigger loader revalidation
      revalidator.revalidate();
      
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  return (
    <div>
      {data.map(item => (
        <div key={item.id}>
          <button onClick={() => handleDelete(item.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

**Why:**
- ✅ Single source of truth (server)
- ✅ Automatic data sync
- ✅ No manual state updates
- ✅ Consistent with Remix patterns

### ❌ DON'T: Manually Update State

**Anti-pattern:**
```typescript
// ❌ WRONG
const handleDelete = async (id: string) => {
  await deleteItem(id);
  setData(data.filter(item => item.id !== id)); // Manual state update
};
```

**Why it's wrong:**
- ❌ State can get out of sync with server
- ❌ Duplicated logic (client + server)
- ❌ Race conditions
- ❌ Harder to maintain

---

## URL-Based State Management

### ✅ DO: Use URL for Shareable State

**Pattern:**
```typescript
export default function ResourceList() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read state from URL
  const activeTab = searchParams.get("tab") || "overview";
  const status = searchParams.get("status") || "all";
  const sort = searchParams.get("sort") || "updated_at_desc";
  
  // Update state by updating URL
  const handleTabChange = (tab: string) => {
    setSearchParams({ tab, status, sort }); // Preserve other params
  };
  
  const handleFilterChange = (newStatus: string) => {
    setSearchParams({ tab: activeTab, status: newStatus, sort });
  };
  
  return <div>{/* UI */}</div>;
}
```

**Benefits:**
- ✅ Shareable URLs (`/resources/123?tab=documents&status=active`)
- ✅ Bookmarkable states
- ✅ Browser back button works
- ✅ Deep linking support

### When to use URL state:
- ✅ Tabs
- ✅ Filters
- ✅ Sort order
- ✅ Search queries
- ✅ Pagination (if server-side)

### When to use React state:
- ✅ Modal open/closed
- ✅ Dropdown expanded
- ✅ Form input values (before submit)
- ✅ UI-only state (doesn't affect data)

---

## Complete Example

Here's a complete example combining all patterns:

### Route File: `app/routes/products.$id.tsx`

```typescript
import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
  ShouldRevalidateFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { Product, Review } from "@supplex/types";

// ============================================================================
// LOADER - Fetch all data server-side
// ============================================================================

export async function loader(args: LoaderFunctionArgs) {
  // 1. Authentication
  const { session } = await requireAuth(args);
  
  // 2. Get params
  const { id } = args.params;
  if (!id) {
    throw new Response("Product ID required", { status: 400 });
  }
  
  // 3. Create API client
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const client = createEdenTreatyClient(token);
  
  // 4. Fetch data in parallel
  try {
    const [productResponse, reviewsResponse] = await Promise.all([
      client.api.products[id].get(),
      client.api.products[id].reviews.get(),
    ]);
    
    // 5. Error handling
    if (productResponse.error) {
      const status = productResponse.status || 500;
      if (status === 404) {
        throw new Response("Product not found", { status: 404 });
      }
      throw new Response("Failed to load product", { status });
    }
    
    // 6. Return all data
    return json({
      product: productResponse.data.product,
      reviews: reviewsResponse.data?.reviews || [],
      token,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response("Failed to load product", { status: 500 });
  }
}

// ============================================================================
// SHOULD REVALIDATE - Prevent unnecessary revalidation
// ============================================================================

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) {
  // Don't revalidate on search param changes (tab switches)
  if (currentUrl.pathname === nextUrl.pathname) {
    if (currentUrl.searchParams.toString() !== nextUrl.searchParams.toString()) {
      return false;
    }
  }
  
  return defaultShouldRevalidate;
}

// ============================================================================
// ACTION - Handle mutations
// ============================================================================

export async function action(args: ActionFunctionArgs) {
  const { session } = await requireAuth(args);
  const { id } = args.params;
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  const client = createEdenTreatyClient(session.access_token);
  
  if (intent === "add-review") {
    const rating = formData.get("rating");
    const comment = formData.get("comment");
    
    const response = await client.api.products[id].reviews.post({
      rating: Number(rating),
      comment: String(comment),
    });
    
    if (response.error) {
      return json({ error: "Failed to add review" }, { status: 500 });
    }
    
    return json({ success: true });
  }
  
  return json({ error: "Invalid intent" }, { status: 400 });
}

// ============================================================================
// COMPONENT - Use loader data via props
// ============================================================================

export default function ProductDetail() {
  const { product, reviews, token } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL-based state
  const activeTab = searchParams.get("tab") || "details";
  
  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };
  
  return (
    <div>
      <h1>{product.name}</h1>
      
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details">
          <ProductDetails product={product} />
        </TabsContent>
        
        <TabsContent value="reviews">
          <ReviewsList reviews={reviews} token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// META - SEO optimization
// ============================================================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.product) {
    return [{ title: "Product Not Found" }];
  }
  
  return [
    { title: `${data.product.name} | Supplex` },
    { name: "description", content: data.product.description },
  ];
};

// ============================================================================
// ERROR BOUNDARY - Graceful error handling
// ============================================================================

export function ErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div>
        <h1>Product Not Found</h1>
        <Link to="/products">Back to Products</Link>
      </div>
    );
  }
  
  return (
    <div>
      <h1>Something went wrong</h1>
      <Link to="/products">Back to Products</Link>
    </div>
  );
}
```

### Child Component: `ReviewsList.tsx`

```typescript
import { useState } from "react";
import { useRevalidator } from "@remix-run/react";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { Review } from "@supplex/types";

interface ReviewsListProps {
  reviews: Review[];
  token: string;
}

export function ReviewsList({ reviews, token }: ReviewsListProps) {
  const revalidator = useRevalidator();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const handleDelete = async (reviewId: string) => {
    setIsDeleting(reviewId);
    
    try {
      const client = createEdenTreatyClient(token);
      const response = await client.api.reviews[reviewId].delete();
      
      if (response.error) {
        throw new Error("Delete failed");
      }
      
      // ✅ Trigger revalidation to refresh data
      revalidator.revalidate();
      
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(null);
    }
  };
  
  return (
    <div>
      {reviews.map(review => (
        <div key={review.id}>
          <p>{review.comment}</p>
          <button
            onClick={() => handleDelete(review.id)}
            disabled={isDeleting === review.id}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Checklist for New Routes

When implementing a new route, follow this checklist:

### Server-Side
- [ ] Loader fetches all required data
- [ ] Uses `Promise.all` for parallel fetching
- [ ] Includes proper error handling
- [ ] Returns `token` if mutations are needed
- [ ] Has proper TypeScript types
- [ ] Includes authentication with `requireAuth`

### Optimization
- [ ] Has `shouldRevalidate` if using URL state (tabs, filters)
- [ ] Meta function for SEO
- [ ] Error boundary for graceful errors

### Component
- [ ] Receives data via props (not useEffect)
- [ ] Uses `useRevalidator` for mutations
- [ ] Uses `useSearchParams` for URL state
- [ ] No manual state synchronization
- [ ] Proper loading states only during mutations

### Testing
- [ ] Initial page load works
- [ ] URL state works (shareable)
- [ ] Browser back button works
- [ ] No unnecessary API calls on URL changes
- [ ] Mutations trigger revalidation
- [ ] No auth logs on URL-only changes

---

## Common Mistakes to Avoid

### ❌ 1. Fetching data in useEffect
```typescript
// ❌ WRONG
useEffect(() => {
  fetchData();
}, [id]);
```

### ❌ 2. Missing shouldRevalidate with URL state
```typescript
// ❌ WRONG - Will revalidate on every tab switch
// Missing: export function shouldRevalidate(...)
```

### ❌ 3. Manual state updates after mutations
```typescript
// ❌ WRONG
await deleteItem(id);
setItems(items.filter(i => i.id !== id)); // Manual update
```

### ❌ 4. Not using Promise.all for parallel requests
```typescript
// ❌ WRONG - Sequential (slow)
const product = await fetchProduct(id);
const reviews = await fetchReviews(id);

// ✅ CORRECT - Parallel (fast)
const [product, reviews] = await Promise.all([
  fetchProduct(id),
  fetchReviews(id),
]);
```

### ❌ 5. Passing IDs instead of data
```typescript
// ❌ WRONG
<ChildComponent resourceId={id} token={token} />

// ✅ CORRECT
<ChildComponent data={data} token={token} />
```

---

## Performance Benefits

| Pattern | Impact |
|---------|--------|
| Server-side loading | Fast initial render (SSR) |
| Promise.all | Eliminates waterfalls |
| shouldRevalidate | Eliminates unnecessary API calls |
| Props-based components | No loading states, simpler code |
| Revalidation | Automatic data sync |

---

## References

- [Remix Data Loading](https://remix.run/docs/en/main/guides/data-loading)
- [Remix shouldRevalidate](https://remix.run/docs/en/main/route/should-revalidate)
- [Remix useRevalidator](https://remix.run/docs/en/main/hooks/use-revalidator)
- [Implementation Example](./implementation-notes/remix-loader-pattern-optimization.md)

---

**Last Updated**: October 23, 2025  
**Approved By**: Dev Team  
**Status**: Production Standard

