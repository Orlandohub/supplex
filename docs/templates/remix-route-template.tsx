/**
 * Remix Route Template
 *
 * Copy this template when creating new routes.
 * Replace placeholders with your actual implementation.
 *
 * See: docs/architecture/remix-patterns.md for detailed documentation
 */

import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  useRevalidator,
  isRouteErrorResponse,
  useRouteError,
  Link,
} from "@remix-run/react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { YourType } from "@supplex/types";

// ============================================================================
// LOADER - Fetch all data server-side
// ============================================================================

export async function loader(args: LoaderFunctionArgs) {
  // 1. Authentication
  const { session } = await requireAuth(args);

  // 2. Get params
  const { id } = args.params;
  if (!id) {
    throw new Response("ID required", { status: 400 });
  }

  // 3. Create API client
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const client = createEdenTreatyClient(token);

  // 4. Fetch data (use Promise.all for multiple sources)
  try {
    // Single source:
    const response = await client.api.resource[id].get();

    // OR parallel fetching:
    // const [primary, secondary] = await Promise.all([
    //   client.api.resource[id].get(),
    //   client.api.resource[id].related.get(),
    // ]);

    // 5. Error handling
    if (response.error) {
      const status = response.status || 500;
      if (status === 404) {
        throw new Response("Not found", { status: 404 });
      }
      throw new Response("Failed to load data", { status });
    }

    // 6. Return data
    return json({
      data: response.data,
      // secondary: secondary.data || [],
      token, // Pass token for mutations
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response("Failed to load data", { status: 500 });
  }
}

// ============================================================================
// SHOULD REVALIDATE - Prevent unnecessary revalidation
// Only add this if your route has URL state (tabs, filters, sorting)
// ============================================================================

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: {
  currentUrl: URL;
  nextUrl: URL;
  defaultShouldRevalidate: boolean;
}) {
  // Don't revalidate on search param changes (tab switches, filters)
  if (currentUrl.pathname === nextUrl.pathname) {
    if (
      currentUrl.searchParams.toString() !== nextUrl.searchParams.toString()
    ) {
      return false; // URL state changed, but data is the same
    }
  }

  return defaultShouldRevalidate;
}

// ============================================================================
// ACTION - Handle mutations (optional)
// ============================================================================

export async function action(args: ActionFunctionArgs) {
  const { session } = await requireAuth(args);
  const { id } = args.params;
  const { request } = args;
  const formData = await request.formData();
  const intent = formData.get("intent");

  const client = createEdenTreatyClient(session.access_token);

  if (intent === "update") {
    // Handle update
    const response = await client.api.resource[id].patch({
      // ... data
    });

    if (response.error) {
      return json({ error: "Update failed" }, { status: 500 });
    }

    return json({ success: true });
  }

  if (intent === "delete") {
    // Handle delete
    const response = await client.api.resource[id].delete();

    if (response.error) {
      return json({ error: "Delete failed" }, { status: 500 });
    }

    return redirect("/resources?message=deleted");
  }

  return json({ error: "Invalid intent" }, { status: 400 });
}

// ============================================================================
// COMPONENT - Use loader data via props
// ============================================================================

export default function ResourceDetail() {
  const { data } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-based state (if using tabs/filters)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeTab = searchParams.get("tab") || "overview";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTabChange = (tab: string) => {
    setSearchParams({ tab }); // Updates URL, triggers tab switch
  };

  return (
    <div>
      <h1>{data.name}</h1>

      {/* Pass data to child components via props */}
      <ChildComponent data={data} />
    </div>
  );
}

// ============================================================================
// CHILD COMPONENT EXAMPLE - Props-based, uses revalidator for mutations
// ============================================================================

interface ChildComponentProps {
  data: YourType[];
  token: string;
}

function ChildComponent({ data, token }: ChildComponentProps) {
  const revalidator = useRevalidator();

  const handleMutation = async (id: string) => {
    try {
      const client = createEdenTreatyClient(token);
      const response = await client.api.resource[id].delete();

      if (response.error) {
        throw new Error("Mutation failed");
      }

      // ✅ Trigger revalidation to refresh data from server
      revalidator.revalidate();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div>
      {data.map((item) => (
        <div key={item.id}>
          {item.name}
          <button onClick={() => handleMutation(item.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// META - SEO optimization
// ============================================================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.data) {
    return [{ title: "Not Found | Supplex" }];
  }

  return [
    { title: `${data.data.name} | Supplex` },
    { name: "description", content: data.data.description },
  ];
};

// ============================================================================
// ERROR BOUNDARY - Graceful error handling
// ============================================================================

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <h1 className="text-2xl font-bold mb-4">Not Found</h1>
            <p className="text-gray-600 mb-6">
              The requested resource could not be found.
            </p>
            <Link to="/resources" className="text-blue-600 hover:underline">
              Back to Resources
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <h1 className="text-2xl font-bold mb-4">
            {error.status} {error.statusText}
          </h1>
          <p className="text-gray-600 mb-6">{error.data}</p>
          <Link to="/resources" className="text-blue-600 hover:underline">
            Back to Resources
          </Link>
        </div>
      </div>
    );
  }

  // Log to error tracking service in production
  console.error("Unexpected error:", error);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <Link to="/resources" className="text-blue-600 hover:underline">
          Back to Resources
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// CHECKLIST
// ============================================================================

/*
Before submitting, verify:

Server-Side:
[ ] Loader fetches all required data
[ ] Uses Promise.all for parallel fetching
[ ] Proper error handling (404, 500, etc.)
[ ] Returns token if mutations needed
[ ] Proper TypeScript types
[ ] Authentication with requireAuth

Optimization:
[ ] Has shouldRevalidate if using URL state
[ ] Meta function for SEO
[ ] Error boundary for graceful errors

Component:
[ ] Receives data via props (not useEffect)
[ ] Uses useRevalidator for mutations
[ ] Uses useSearchParams for URL state
[ ] No manual state synchronization

Testing:
[ ] Initial page load works
[ ] URL state works (shareable)
[ ] Browser back button works
[ ] No unnecessary API calls on URL changes
[ ] Mutations trigger revalidation
[ ] Error boundaries work
*/
