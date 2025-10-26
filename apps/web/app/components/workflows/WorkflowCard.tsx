import type { WorkflowListItem } from "@supplex/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Calendar, User, TrendingUp } from "lucide-react";

interface WorkflowCardProps {
  workflow: WorkflowListItem;
  onCardClick: (workflowId: string) => void;
}

export function WorkflowCard({ workflow, onCardClick }: WorkflowCardProps) {
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
      return <Badge variant="secondary">Risk: Unknown</Badge>;
    }

    if (riskScore < 3.0) {
      return (
        <Badge variant="success">Risk: Low ({riskScore.toFixed(2)})</Badge>
      );
    } else if (riskScore <= 6.0) {
      return (
        <Badge variant="warning">Risk: Medium ({riskScore.toFixed(2)})</Badge>
      );
    } else {
      return (
        <Badge variant="destructive">Risk: High ({riskScore.toFixed(2)})</Badge>
      );
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
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={() => onCardClick(workflow.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{workflow.supplierName}</CardTitle>
          {getStatusBadge(workflow.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Stage */}
        <div className="flex items-center text-sm">
          <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Stage:</span>
          <span className="ml-2 text-muted-foreground">
            {formatCurrentStage(workflow)}
          </span>
        </div>

        {/* Initiated By */}
        <div className="flex items-center text-sm">
          <User className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Initiated by:</span>
          <span className="ml-2 text-muted-foreground">
            {workflow.initiatedBy}
          </span>
        </div>

        {/* Initiated Date & Days */}
        <div className="flex items-center text-sm">
          <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Started:</span>
          <span className="ml-2 text-muted-foreground">
            {formatDate(workflow.initiatedDate)} ({workflow.daysInProgress}{" "}
            {workflow.daysInProgress === 1 ? "day" : "days"})
          </span>
        </div>

        {/* Risk Score Badge */}
        <div className="pt-2">{getRiskBadge(workflow.riskScore)}</div>
      </CardContent>
    </Card>
  );
}
