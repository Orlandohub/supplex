import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { FileCheck, Plus } from "lucide-react";
import type { QualificationWorkflow } from "@supplex/types";
import { getRiskScoreColor } from "@supplex/types";

interface QualificationsTabProps {
  workflows: QualificationWorkflow[];
  onStartQualification?: () => void;
}

/**
 * Qualifications Tab Component (AC 8-9)
 * Displays a table of qualification workflows for a supplier
 *
 * Features:
 * - Status badges with color coding
 * - Initiated by and date information
 * - Risk score display
 * - Empty state with CTA
 * - Mobile-responsive design (card layout on small screens)
 */
export function QualificationsTab({
  workflows,
  onStartQualification,
}: QualificationsTabProps) {
  // Empty state when no workflows exist
  if (workflows.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileCheck className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Qualification Workflows
        </h3>
        <p className="text-gray-600 mb-6">
          This supplier has not yet started the qualification process.
        </p>
        {onStartQualification && (
          <Button onClick={onStartQualification} className="mx-auto">
            <Plus className="h-4 w-4 mr-2" />
            Start Qualification
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

  // Format risk score with color indicator (AC 5 color ranges)
  const getRiskScoreColorClass = (score: string | null) => {
    if (!score) return "text-gray-500";
    const color = getRiskScoreColor(score);
    const colorMap = {
      green: "text-green-600",
      yellow: "text-yellow-600",
      red: "text-red-600",
    };
    return colorMap[color];
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
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Initiated Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workflows.map((workflow) => (
                  <tr
                    key={workflow.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <WorkflowStatusBadge status={workflow.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(workflow.initiatedDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-semibold ${getRiskScoreColorClass(
                          workflow.riskScore
                        )}`}
                      >
                        {workflow.riskScore
                          ? parseFloat(workflow.riskScore).toFixed(2)
                          : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Stage {workflow.currentStage || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <WorkflowStatusBadge status={workflow.status} />
                <span
                  className={`text-sm font-semibold ${getRiskScoreColorClass(
                    workflow.riskScore
                  )}`}
                >
                  Risk:{" "}
                  {workflow.riskScore
                    ? parseFloat(workflow.riskScore).toFixed(2)
                    : "N/A"}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <div>Initiated: {formatDate(workflow.initiatedDate)}</div>
                <div>Stage {workflow.currentStage || 0}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
