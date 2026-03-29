/**
 * Workflow Process List Component
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * Displays list of workflow processes with filtering and sorting
 */

import { useState } from "react";
import { Link } from "@remix-run/react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface ProcessInstance {
  id: string;
  processType: string;
  entityType: string;
  entityId: string;
  status: string;
  initiatedBy: string;
  initiatedDate: string;
  completedDate?: string | null;
}

interface User {
  id: string;
  email: string;
  fullName: string;
}

interface WorkflowProcessListProps {
  processes: ProcessInstance[];
  token: string;
  user: User;
}

export function WorkflowProcessList({
  processes,
  token,
  user,
}: WorkflowProcessListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");

  const filteredProcesses = processes.filter((process) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "in_progress") return process.status === "in_progress";
    if (statusFilter === "pending_validation") return process.status === "pending_validation";
    if (statusFilter === "declined") return process.status === "declined_resubmit";
    if (statusFilter === "completed") return process.status === "complete";
    if (statusFilter === "cancelled") return process.status === "cancelled";
    return true;
  });

  // Sort processes
  const sortedProcesses = [...filteredProcesses].sort((a, b) => {
    if (sortBy === "recent") {
      return new Date(b.initiatedDate).getTime() - new Date(a.initiatedDate).getTime();
    } else if (sortBy === "oldest") {
      return new Date(a.initiatedDate).getTime() - new Date(b.initiatedDate).getTime();
    }
    return 0;
  });

  const STATUS_DISPLAY: Record<string, string> = {
    in_progress: "In Progress",
    pending_validation: "Pending Validation",
    declined_resubmit: "Declined - Re-Submit",
    complete: "Complete",
    cancelled: "Cancelled",
  };

  const getStatusLabel = (status: string): string => {
    return STATUS_DISPLAY[status] || status;
  };

  const getStatusColor = (status: string) => {
    if (status === "complete") return "bg-green-100 text-green-800";
    if (status === "in_progress") return "bg-blue-100 text-blue-800";
    if (status === "pending_validation") return "bg-amber-100 text-amber-800";
    if (status === "declined_resubmit") return "bg-red-100 text-red-800";
    if (status === "cancelled") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Filters and Sorting */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_validation">Pending Validation</option>
              <option value="declined">Declined</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="ml-auto text-sm text-gray-600">
            Showing {sortedProcesses.length} of {processes.length} processes
          </div>
        </div>
      </Card>

      {/* Process Cards */}
      {sortedProcesses.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Processes Found
          </h3>
          <p className="text-gray-600">
            {statusFilter !== "all"
              ? `No ${statusFilter} processes at the moment`
              : "No workflow processes have been initiated yet"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedProcesses.map((process) => (
            <Card key={process.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {process.processType
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {process.entityType} • {process.entityId}
                  </p>
                </div>
                <Badge className={getStatusColor(process.status)}>
                  {getStatusLabel(process.status)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-gray-500">Initiated Date</p>
                  <p className="font-medium">
                    {new Date(process.initiatedDate).toLocaleDateString()}
                  </p>
                </div>
                {process.completedDate && (
                  <div>
                    <p className="text-gray-500">Completed Date</p>
                    <p className="font-medium">
                      {new Date(process.completedDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button asChild variant="outline">
                  <Link to={`/workflows/processes/${process.id}`}>
                    View Details
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

