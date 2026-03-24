/**
 * Workflows Page (Story 2.2.9 - AC 18, 19)
 * Global workflows page at /workflows
 * Lists all workflow processes across all suppliers
 * 
 * Replaces legacy /qualifications route
 */

import type {
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, Link, useRouteLoaderData } from "@remix-run/react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { AppLoaderData } from "~/routes/_app";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Workflow, Settings, Plus } from "lucide-react";
import { InitiateWorkflowDialog } from "~/components/workflows/InitiateWorkflowDialog";

interface ProcessInstance {
  id: string;
  processType: string;
  entityType: string;
  entityId: string;
  status: string;
  initiatedBy: string;
  initiatedDate: string;
  completedDate: string | null;
  metadata: Record<string, unknown> | null;
  supplierName: string | null;
  initiatorName: string | null;
  currentStepName: string | null;
  currentStepOrder: number | null;
  workflowName: string | null;
}

export const meta: MetaFunction = () => {
  return [
    { title: "Workflows | Supplex" },
    {
      name: "description",
      content: "View and manage workflow processes across all suppliers",
    },
  ];
};

/**
 * Loader function to fetch all workflow processes
 */
export async function loader(args: LoaderFunctionArgs) {
  const { session, user } = await requireAuth(args);

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  try {
    // Fetch all processes
    const response = await client.api.workflows.processes.get();

    if (response.error) {
      const status = response.status || 500;
      console.error("Processes API Error:", response.error);
      throw new Response(
        response.error.message || "Failed to load processes",
        { status }
      );
    }

    const data = response.data;
    if (!data?.success || !data.data) {
      throw new Response("Invalid API response", { status: 500 });
    }

    return json({
      processes: data.data.processes,
      token,
      user,
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("Loader error:", error);
    throw new Response("Failed to load workflow processes", { status: 500 });
  }
}

/**
 * Get status badge variant based on process status
 */
function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "completed":
      return "default";
    case "in_progress":
      return "secondary";
    case "cancelled":
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Main component
 */
export default function WorkflowsIndex() {
  const { processes, token, user } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  
  // Get permissions from parent loader (SSR-safe)
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
  const permissions = appData?.permissions;

  const isLoading = navigation.state === "loading";
  const hasProcesses = processes.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Workflow className="h-6 w-6" />
                Workflows
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track and manage workflow processes across your organization
              </p>
            </div>
            <div className="flex gap-2">
              {/* Initiate Workflow Button */}
              {permissions?.canCreateSuppliers && (
                <InitiateWorkflowDialog token={token} user={user}>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Initiate Workflow
                  </Button>
                </InitiateWorkflowDialog>
              )}
              {/* Manage Templates Button */}
              {permissions?.isAdmin && (
                <Button variant="outline" asChild>
                  <Link to="/settings/workflow-templates" className="inline-flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Templates
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Empty State (no processes) */}
        {!isLoading && !hasProcesses && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Workflow className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">No Workflow Processes</h2>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                No workflow processes have been initiated yet. Start by initiating a new workflow
                for a supplier or other entity.
              </p>
              {permissions?.canCreateSuppliers && (
                <InitiateWorkflowDialog token={token} user={user}>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Initiate Workflow
                  </Button>
                </InitiateWorkflowDialog>
              )}
            </CardContent>
          </Card>
        )}

        {/* Desktop Table View */}
        {!isLoading && hasProcesses && (
          <>
            <div className="hidden md:block">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Current Step</TableHead>
                      <TableHead>Initiated By</TableHead>
                      <TableHead>Initiated Date</TableHead>
                      <TableHead>Completed Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processes.map((process: ProcessInstance) => (
                      <TableRow key={process.id}>
                        <TableCell className="font-medium">
                          {process.workflowName || process.processType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {process.supplierName || process.entityId}
                            </div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {process.entityType}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {process.status === "completed" ? (
                            <Badge variant="default">Completed</Badge>
                          ) : process.status === "cancelled" ? (
                            <Badge variant="destructive">Cancelled</Badge>
                          ) : process.currentStepName ? (
                            <div>
                              <div className="font-medium">{process.currentStepName}</div>
                              <div className="text-sm text-muted-foreground">
                                Step {process.currentStepOrder}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{process.initiatorName || process.initiatedBy}</TableCell>
                        <TableCell>
                          {new Date(process.initiatedDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {process.completedDate
                            ? new Date(process.completedDate).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/workflows/processes/${process.id}`}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-4">
              {processes.map((process: ProcessInstance) => (
                <Card key={process.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>
                        {process.workflowName || process.processType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      {process.status === "completed" && (
                        <Badge variant="default">Completed</Badge>
                      )}
                      {process.status === "cancelled" && (
                        <Badge variant="destructive">Cancelled</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Entity:</span>{" "}
                      {process.supplierName || process.entityId}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Type:</span>{" "}
                      <span className="capitalize">{process.entityType}</span>
                    </div>
                    {process.status !== "completed" && process.status !== "cancelled" && process.currentStepName && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Current Step:</span>{" "}
                        <span className="font-medium">{process.currentStepName}</span>
                        {" "}(Step {process.currentStepOrder})
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Initiated by:</span>{" "}
                      {process.initiatorName || process.initiatedBy}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Initiated:</span>{" "}
                      {new Date(process.initiatedDate).toLocaleDateString()}
                    </div>
                    {process.completedDate && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Completed:</span>{" "}
                        {new Date(process.completedDate).toLocaleDateString()}
                      </div>
                    )}
                    <Button asChild className="w-full mt-4" variant="outline">
                      <Link to={`/workflows/processes/${process.id}`}>
                        View Process
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

