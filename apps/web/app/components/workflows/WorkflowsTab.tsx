import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { FileCheck, Plus } from "lucide-react";
import { Link } from "react-router";

interface ProcessInstance {
  id: string;
  processType: string;
  status: string;
  initiatedDate: string;
  completedDate?: string | null;
  entityType: string;
  entityId: string;
  workflowName?: string | null;
  metadata?: Record<string, unknown>;
  activeStep?: {
    id: string;
    stepName?: string;
    assigneeUserId?: string | null;
    assigneeRole?: string | null;
  } | null;
  lastCompletedStep?: {
    stepName: string;
    status: string;
    completedDate?: string | null;
  } | null;
}

interface WorkflowsTabProps {
  workflows: ProcessInstance[];
  supplierId: string;
  onStartProcess?: () => void;
}

/**
 * Workflows Tab Component (Story 2.2.9 - AC 6-7)
 * Displays workflow process instances for a supplier (NEW WORKFLOW ENGINE)
 *
 * Features:
 * - Status badges with color coding
 * - Initiated date information
 * - Process type display
 * - Empty state with CTA
 * - Mobile-responsive design
 * - Links to workflow process detail pages
 */
export function WorkflowsTab({
  workflows,
  supplierId: _supplierId,
  onStartProcess,
}: WorkflowsTabProps) {
  // Empty state when no workflows exist
  if (workflows.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileCheck className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Workflow Processes
        </h3>
        <p className="text-gray-600 mb-6">
          No workflow processes started yet. Click &apos;Start Process&apos; to
          begin.
        </p>
        {onStartProcess && (
          <Button onClick={onStartProcess} className="mx-auto">
            <Plus className="h-4 w-4 mr-2" />
            Start Process
          </Button>
        )}
      </Card>
    );
  }

  // Format date to readable string
  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const STATUS_DISPLAY: Record<string, string> = {
    in_progress: "In Progress",
    pending_validation: "Pending Validation",
    declined_resubmit: "Declined - Re-Submit",
    complete: "Complete",
    cancelled: "Cancelled",
  };

  const getStatusLabel = (status: string, stepName?: string | null): string => {
    const label = STATUS_DISPLAY[status] || status;
    if (status === "complete" || status === "cancelled") return label;
    return stepName ? `${stepName} - ${label}` : label;
  };

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "complete") return "default";
    if (status === "in_progress") return "secondary";
    if (status === "pending_validation") return "outline";
    if (status === "declined_resubmit") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Process
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Completed Step
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Initiated Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workflows.map((workflow) => {
                  return (
                    <tr
                      key={workflow.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {workflow.workflowName ||
                          workflow.processType ||
                          "Workflow"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getStatusVariant(workflow.status)}>
                          {getStatusLabel(
                            workflow.status,
                            workflow.activeStep?.stepName
                          )}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {workflow.lastCompletedStep ? (
                          <div>
                            <p className="text-gray-900">
                              {workflow.lastCompletedStep.stepName}
                            </p>
                            {workflow.lastCompletedStep.completedDate && (
                              <p className="text-xs text-gray-500">
                                {formatDate(
                                  workflow.lastCompletedStep.completedDate
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(workflow.initiatedDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/workflows/processes/${workflow.id}`}>
                            View Details
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {workflows.map((workflow) => {
          return (
            <Card key={workflow.id} className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-gray-900">
                    {workflow.workflowName ||
                      workflow.processType ||
                      "Workflow"}
                  </div>
                  <Badge variant={getStatusVariant(workflow.status)}>
                    {getStatusLabel(
                      workflow.status,
                      workflow.activeStep?.stepName
                    )}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Initiated: {formatDate(workflow.initiatedDate)}</div>
                  {workflow.lastCompletedStep && (
                    <div>
                      Last Step: {workflow.lastCompletedStep.stepName}
                      {workflow.lastCompletedStep.completedDate && (
                        <span className="text-gray-400">
                          {" "}
                          (
                          {formatDate(workflow.lastCompletedStep.completedDate)}
                          )
                        </span>
                      )}
                    </div>
                  )}
                  {workflow.completedDate && (
                    <div>Completed: {formatDate(workflow.completedDate)}</div>
                  )}
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to={`/workflows/processes/${workflow.id}`}>
                    View Details
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
