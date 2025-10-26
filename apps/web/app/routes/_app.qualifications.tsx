import type {
  LoaderFunctionArgs,
  MetaFunction,
  ShouldRevalidateFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, useNavigate } from "@remix-run/react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { WorkflowListItem, WorkflowListResponse } from "@supplex/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { WorkflowFilters } from "~/components/workflows/WorkflowFilters";
import { WorkflowTable } from "~/components/workflows/WorkflowTable";
import { WorkflowCard } from "~/components/workflows/WorkflowCard";
import { WorkflowPagination } from "~/components/workflows/WorkflowPagination";
import { WorkflowsEmptyState } from "~/components/workflows/WorkflowsEmptyState";
import { Button } from "~/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Qualifications | Supplex" },
    {
      name: "description",
      content: "Track and manage supplier qualification workflows",
    },
  ];
};

/**
 * shouldRevalidate - Prevent revalidation on search param changes
 * This allows URL-based state for filters without triggering unnecessary API calls
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  // Don't revalidate on search param changes (filters, tabs, sorting, pagination)
  if (currentUrl.pathname === nextUrl.pathname) {
    if (
      currentUrl.searchParams.toString() !== nextUrl.searchParams.toString()
    ) {
      return true; // We DO want to revalidate on filter changes to fetch new data
    }
  }

  // Route change or action = use default behavior
  return defaultShouldRevalidate;
};

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;
  const { session } = await requireAuth(args);

  // Extract query parameters from URL
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const stage = url.searchParams.get("stage") || undefined;
  const riskLevel = url.searchParams.get("riskLevel") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const sortBy = url.searchParams.get("sortBy") || "initiated_date";
  const sortOrder =
    (url.searchParams.get("sortOrder") as "asc" | "desc") || "desc";
  const page = Number(url.searchParams.get("page")) || 1;
  const limit = Number(url.searchParams.get("limit")) || 20;
  const tab = url.searchParams.get("tab") || "all";

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  try {
    // Fetch workflows from API
    const response = await client.api.workflows.qualifications.get({
      query: {
        status,
        stage,
        riskLevel,
        search,
        sortBy: sortBy as any,
        sortOrder,
        page,
        limit,
        tab: tab as any,
      },
    });

    if (response.error) {
      console.error("API Error:", response.error);
      throw new Response("Failed to load workflows", { status: 500 });
    }

    if (
      !response.data ||
      typeof response.data !== "object" ||
      !("data" in response.data)
    ) {
      throw new Response("Invalid API response format", { status: 500 });
    }

    const apiResponse = response.data as {
      success: boolean;
      data: WorkflowListResponse;
    };

    return json({
      workflows: apiResponse.data.workflows,
      total: apiResponse.data.total,
      page: apiResponse.data.page,
      limit: apiResponse.data.limit,
      token, // Pass token for client-side CSV export
      filters: {
        status,
        stage,
        riskLevel,
        search,
        sortBy,
        sortOrder,
        tab,
      },
    });
  } catch (error) {
    console.error("Error loading workflows:", error);
    throw new Response("Failed to load workflows", { status: 500 });
  }
}

type LoaderData = {
  workflows: WorkflowListItem[];
  total: number;
  page: number;
  limit: number;
  token: string;
  filters: {
    status?: string;
    stage?: string;
    riskLevel?: string;
    search?: string;
    sortBy: string;
    sortOrder: string;
    tab: string;
  };
};

export default function QualificationsPage() {
  const { workflows, total, page, limit, token, filters } =
    useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  // Calculate total pages
  const totalPages = Math.ceil(total / limit);

  // Tab change handler
  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", newTab);
    params.set("page", "1"); // Reset to page 1 when changing tabs
    setSearchParams(params);
  };

  // Filter change handler
  const handleFilterChange = (
    filterName: string,
    value: string | undefined
  ) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "All") {
      params.set(filterName, value);
    } else {
      params.delete(filterName);
    }
    params.set("page", "1"); // Reset to page 1 when changing filters
    setSearchParams(params);
  };

  // Sort change handler
  const handleSortChange = (sortBy: string, sortOrder: "asc" | "desc") => {
    const params = new URLSearchParams(searchParams);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    setSearchParams(params);
  };

  // Pagination handler
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    setSearchParams(params);
  };

  // Row click handler - navigate to workflow detail
  const handleRowClick = (workflowId: string) => {
    navigate(`/workflows/${workflowId}`);
  };

  // Export CSV handler
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const client = createClientEdenTreatyClient(token);

      // Call export endpoint with current filters
      const response = await client.api.workflows.qualifications.export.get({
        query: {
          status: filters.status,
          stage: filters.stage,
          riskLevel: filters.riskLevel,
          search: filters.search,
          sortBy: filters.sortBy as any,
          sortOrder: filters.sortOrder as any,
          tab: filters.tab as any,
        },
      });

      if (response.error || !response.data) {
        throw new Error("Export failed");
      }

      // Create blob and trigger download
      const csvContent = response.data as unknown as string;
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `qualifications-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Workflows exported successfully",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export workflows to CSV",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Qualifications</h1>
          <p className="text-muted-foreground">
            Track and manage supplier qualification workflows
          </p>
        </div>
        <Button onClick={handleExportCSV} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Tabs: All, My Tasks, My Initiated */}
      <Tabs value={filters.tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="myTasks">My Tasks</TabsTrigger>
          <TabsTrigger value="myInitiated">My Initiated</TabsTrigger>
        </TabsList>

        <TabsContent value={filters.tab} className="space-y-4">
          {/* Filters */}
          <WorkflowFilters
            currentFilters={{
              status: filters.status,
              stage: filters.stage,
              riskLevel: filters.riskLevel,
              search: filters.search,
            }}
            onFilterChange={handleFilterChange}
          />

          {/* Empty State or Data */}
          {workflows.length === 0 ? (
            <WorkflowsEmptyState />
          ) : (
            <>
              {/* Desktop: Table View */}
              <div className="hidden md:block">
                <WorkflowTable
                  workflows={workflows}
                  sortBy={filters.sortBy}
                  sortOrder={filters.sortOrder as "asc" | "desc"}
                  onSort={handleSortChange}
                  onRowClick={handleRowClick}
                />
              </div>

              {/* Mobile: Card View */}
              <div className="block md:hidden space-y-4">
                {workflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    onCardClick={handleRowClick}
                  />
                ))}
              </div>

              {/* Pagination */}
              <WorkflowPagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                itemsPerPage={limit}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
