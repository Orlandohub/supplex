import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useNavigation } from "@remix-run/react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { SupplierTable } from "~/components/suppliers/SupplierTable";
import { SupplierCard } from "~/components/suppliers/SupplierCard";
import { SupplierSearchBar } from "~/components/suppliers/SupplierSearchBar";
import { SupplierFilters } from "~/components/suppliers/SupplierFilters";
import { SupplierPagination } from "~/components/suppliers/SupplierPagination";
import { EmptySupplierState } from "~/components/suppliers/EmptySupplierState";
import { SupplierTableSkeleton } from "~/components/suppliers/SupplierTableSkeleton";
import type { Supplier } from "@supplex/types";

export const meta: MetaFunction = () => {
  return [
    { title: "Suppliers | Supplex" },
    {
      name: "description",
      content: "Manage and view your supplier list with search and filtering.",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Protect this route - require authentication
  const { session } = await requireAuth(request);
  
  // Extract query parameters from URL
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || undefined;
  const status = url.searchParams.getAll("status");
  const category = url.searchParams.getAll("category");
  const page = Number(url.searchParams.get("page")) || 1;
  const limit = Number(url.searchParams.get("limit")) || 20;
  const sort = url.searchParams.get("sort") || "updated_at_desc";

  // Create Eden Treaty client with auth token
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Fetch suppliers from API
  try {
    const response = await client.api.suppliers.get({
      query: {
        search,
        status,
        category,
        page,
        limit,
        sort,
      },
    });

    // Handle API errors
    if (response.error) {
      console.error("API Error:", response.error);
      throw new Response("Failed to load suppliers", { status: 500 });
    }

    const data = response.data as any;

    return json({
      suppliers: data.data.suppliers as Supplier[],
      total: data.data.total as number,
      page: data.data.page as number,
      limit: data.data.limit as number,
      filters: {
        search: search || "",
        status,
        category,
        sort,
      },
    });
  } catch (error) {
    console.error("Failed to fetch suppliers:", error);
    throw new Response("Failed to load suppliers", { status: 500 });
  }
}

export default function SuppliersIndex() {
  const { suppliers, total, page, limit, filters } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();

  // Check if we're loading
  const isLoading = navigation.state === "loading";

  // Check if we have any suppliers
  const hasSuppliers = suppliers.length > 0;

  // Check if we have any active filters
  const hasActiveFilters = 
    filters.search ||
    filters.status.length > 0 ||
    filters.category.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage and view your supplier information
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <SupplierSearchBar initialSearch={filters.search} />
          <SupplierFilters
            activeStatus={filters.status}
            activeCategory={filters.category}
          />
        </div>

        {/* Loading State */}
        {isLoading && <SupplierTableSkeleton />}

        {/* Empty State (no suppliers at all) */}
        {!isLoading && !hasSuppliers && !hasActiveFilters && (
          <EmptySupplierState />
        )}

        {/* Empty State (no results for filters) */}
        {!isLoading && !hasSuppliers && hasActiveFilters && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              No suppliers match your filters
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}

        {/* Supplier List - Desktop Table View */}
        {!isLoading && hasSuppliers && (
          <>
            <div className="hidden md:block">
              <SupplierTable suppliers={suppliers} currentSort={filters.sort} />
            </div>

            {/* Supplier List - Mobile Card View */}
            <div className="block md:hidden space-y-4">
              {suppliers.map((supplier) => (
                <SupplierCard key={supplier.id} supplier={supplier} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6">
              <SupplierPagination
                currentPage={page}
                totalItems={total}
                itemsPerPage={limit}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

