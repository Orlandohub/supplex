import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useNavigation,
  isRouteErrorResponse,
  useRouteError,
  Link,
  useSearchParams,
} from "@remix-run/react";
import { useEffect } from "react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { Supplier, Document } from "@supplex/types";
import { SupplierDetailTabs } from "~/components/suppliers/SupplierDetailTabs";
import { SupplierDetailSkeleton } from "~/components/suppliers/SupplierDetailSkeleton";
import { Breadcrumb } from "~/components/ui/Breadcrumb";
import { useToast } from "~/hooks/useToast";

// Type for supplier data after Remix serialization (Dates become strings)
type SerializedSupplier = Omit<
  Supplier,
  "createdAt" | "updatedAt" | "deletedAt" | "certifications"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  certifications: Array<{
    type: string;
    issueDate: string;
    expiryDate: string;
    documentId?: string;
  }>;
  createdByName?: string;
  createdByEmail?: string | null;
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.supplier) {
    return [
      { title: "Supplier Not Found | Supplex" },
      {
        name: "description",
        content: "The requested supplier could not be found.",
      },
    ];
  }
  return [
    { title: `${data.supplier.name} | Supplex` },
    {
      name: "description",
      content: `View details for supplier ${data.supplier.name}`,
    },
  ];
};

/**
 * Loader function to fetch supplier details
 * Handles authentication and API calls
 */
export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;

  // Protect this route - require authentication
  const { session } = await requireAuth(args);

  // Get supplier ID from URL params
  const { id } = params;
  if (!id) {
    throw new Response("Supplier ID is required", { status: 400 });
  }

  // Create Eden Treaty client with auth token
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Fetch supplier and documents in parallel for optimal performance
  try {
    const [supplierResponse, documentsResponse] = await Promise.all([
      client.api.suppliers[id].get(),
      client.api.suppliers[id].documents.get(),
    ]);

    // Handle supplier API errors
    if (supplierResponse.error) {
      const status = supplierResponse.status || 500;
      if (status === 404) {
        throw new Response("Supplier not found", { status: 404 });
      }
      console.error("Supplier API Error:", supplierResponse.error);
      throw new Response("Failed to load supplier", { status });
    }

    // Validate supplier response data
    if (
      !supplierResponse.data ||
      typeof supplierResponse.data !== "object" ||
      !("data" in supplierResponse.data)
    ) {
      throw new Response("Invalid API response format", { status: 500 });
    }

    const supplierApiResponse = supplierResponse.data as {
      success: boolean;
      data: {
        supplier: Supplier & {
          createdByName?: string;
          createdByEmail?: string | null;
        };
      };
    };

    // Handle documents response (non-fatal - if documents fail, still show supplier)
    let documents: Document[] = [];
    if (documentsResponse.error) {
      console.error("Documents API Error:", documentsResponse.error);
      // Don't fail the entire page if documents fail - just show empty list
    } else if (
      documentsResponse.data &&
      typeof documentsResponse.data === "object"
    ) {
      const documentsData = documentsResponse.data as {
        documents?: Document[];
      };
      documents = documentsData.documents || [];
    }

    return json({
      supplier: supplierApiResponse.data.supplier,
      documents,
      token, // Pass token for download/delete operations
    });
  } catch (error) {
    console.error("Failed to fetch supplier:", error);
    // Re-throw Response errors
    if (error instanceof Response) {
      throw error;
    }
    throw new Response("Failed to load supplier", { status: 500 });
  }
}

/**
 * Prevent unnecessary revalidation on tab switches (search param changes)
 * Only revalidate when:
 * - Route params change (different supplier)
 * - Explicit form submission/action
 * - Manual revalidation (after upload/delete)
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
  // If only search params changed (tab switch), don't revalidate
  if (currentUrl.pathname === nextUrl.pathname) {
    const currentParams = currentUrl.searchParams.toString();
    const nextParams = nextUrl.searchParams.toString();

    // Same path, different search params = tab switch = no revalidation
    if (currentParams !== nextParams) {
      return false;
    }
  }

  // For everything else (route change, actions), use default behavior
  return defaultShouldRevalidate;
}

/**
 * Action function to handle status updates and deletes
 */
export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;

  // Protect this route - require authentication
  const { session } = await requireAuth(args);

  const { id } = params;
  if (!id) {
    return json({ error: "Supplier ID is required" }, { status: 400 });
  }

  // Create Eden Treaty client with auth token
  const token = session?.access_token;
  if (!token) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Get form data
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "update-status") {
      // Handle status update
      const status = formData.get("status") as string;
      const note = formData.get("note") as string | undefined;

      const response = await client.api.suppliers[id].status.patch({
        status,
        note,
      });

      if (response.error) {
        return json(
          { error: response.error.value || "Failed to update status" },
          { status: response.status || 500 }
        );
      }

      return json({
        success: true,
        message: "Supplier status updated successfully",
      });
    }

    if (intent === "delete") {
      // Handle delete
      const response = await client.api.suppliers[id].delete();

      if (response.error) {
        return json(
          { error: response.error.value || "Failed to delete supplier" },
          { status: response.status || 500 }
        );
      }

      // Redirect to supplier list after successful delete
      return redirect("/suppliers?message=supplier-deleted");
    }

    return json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Action error:", error);
    return json({ error: "Failed to process request" }, { status: 500 });
  }
}

export default function SupplierDetail() {
  const { supplier, documents, token } = useLoaderData<typeof loader>() as {
    supplier: SerializedSupplier;
    documents: Document[];
    token: string;
  };
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Check if we're loading
  const isLoading = navigation.state === "loading";

  // Show success toast based on URL params
  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "created") {
      toast({
        title: "Supplier created successfully",
        description: "The supplier has been added to your organization.",
        variant: "success",
      });
    } else if (success === "updated") {
      toast({
        title: "Supplier updated successfully",
        description: "The supplier information has been saved.",
        variant: "success",
      });
    }
  }, [searchParams, toast]);

  // Breadcrumb items
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Suppliers", href: "/suppliers" },
    { label: supplier.name, href: "", isCurrentPage: true },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <SupplierDetailSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb */}
          <Breadcrumb items={breadcrumbItems} />

          {/* Page Title */}
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">
              {supplier.name}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SupplierDetailTabs
          supplier={supplier}
          documents={documents}
          token={token}
        />
      </div>
    </div>
  );
}

/**
 * Error Boundary for handling 404 and other errors
 */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-12 max-w-md text-center">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Supplier Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              This supplier doesn&apos;t exist or you don&apos;t have access to
              view it.
            </p>
            <Link
              to="/suppliers"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Suppliers
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-12 max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error.status} {error.statusText}
          </h1>
          <p className="text-gray-600 mb-6">{error.data}</p>
          <Link
            to="/suppliers"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Back to Suppliers
          </Link>
        </div>
      </div>
    );
  }

  // Log error to Sentry in production
  console.error("Unexpected error in supplier detail page:", error);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-12 max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <Link
          to="/suppliers"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Suppliers
        </Link>
      </div>
    </div>
  );
}
