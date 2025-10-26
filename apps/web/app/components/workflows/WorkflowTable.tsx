import type { WorkflowListItem } from "@supplex/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface WorkflowTableProps {
  workflows: WorkflowListItem[];
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
  onRowClick: (workflowId: string) => void;
}

export function WorkflowTable({
  workflows,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
}: WorkflowTableProps) {
  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle sort order
      onSort(column, sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New column, default to desc
      onSort(column, "desc");
    }
  };

  // Render sort icon
  const renderSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string }> = {
      Draft: { variant: "secondary", label: "Draft" },
      Stage1: { variant: "default", label: "Stage 1" },
      Stage2: { variant: "default", label: "Stage 2" },
      Stage3: { variant: "default", label: "Stage 3" },
      Approved: { variant: "success", label: "Approved" },
      Rejected: { variant: "destructive", label: "Rejected" },
    };

    const config = statusMap[status] || {
      variant: "secondary",
      label: status,
    };

    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  // Format current stage for display
  const formatCurrentStage = (workflow: WorkflowListItem) => {
    if (workflow.status === "Approved") return "Approved";
    if (workflow.status === "Rejected") return "Rejected";
    if (workflow.status === "Draft") return "Draft";
    if (workflow.currentStage > 0) {
      return `Stage ${workflow.currentStage}`;
    }
    return "Draft";
  };

  // Get risk level and badge color
  const getRiskBadge = (riskScore: number | null) => {
    if (riskScore === null) {
      return <Badge variant="secondary">Unknown</Badge>;
    }

    if (riskScore < 3.0) {
      return <Badge variant="success">Low ({riskScore.toFixed(2)})</Badge>;
    } else if (riskScore <= 6.0) {
      return <Badge variant="warning">Medium ({riskScore.toFixed(2)})</Badge>;
    } else {
      return <Badge variant="destructive">High ({riskScore.toFixed(2)})</Badge>;
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Current Stage</TableHead>
            <TableHead>Initiated By</TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("initiated_date")}
            >
              <div className="flex items-center">
                Initiated Date
                {renderSortIcon("initiated_date")}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("days_in_progress")}
            >
              <div className="flex items-center">
                Days In Progress
                {renderSortIcon("days_in_progress")}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("risk_score")}
            >
              <div className="flex items-center">
                Risk Score
                {renderSortIcon("risk_score")}
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center py-8 text-muted-foreground"
              >
                No workflows found
              </TableCell>
            </TableRow>
          ) : (
            workflows.map((workflow) => (
              <TableRow
                key={workflow.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick(workflow.id)}
              >
                <TableCell className="font-medium">
                  {workflow.supplierName}
                </TableCell>
                <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                <TableCell>{formatCurrentStage(workflow)}</TableCell>
                <TableCell>{workflow.initiatedBy}</TableCell>
                <TableCell>{formatDate(workflow.initiatedDate)}</TableCell>
                <TableCell>
                  {workflow.daysInProgress}{" "}
                  {workflow.daysInProgress === 1 ? "day" : "days"}
                </TableCell>
                <TableCell>{getRiskBadge(workflow.riskScore)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
