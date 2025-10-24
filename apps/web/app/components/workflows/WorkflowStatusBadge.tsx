import { Badge } from "~/components/ui/badge";
import { WorkflowStatus } from "@supplex/types";

interface WorkflowStatusBadgeProps {
  status: string;
}

/**
 * Workflow Status Badge Component
 * Displays color-coded status badges for qualification workflows (AC 9)
 *
 * Status Colors:
 * - Draft: Gray
 * - Stage 1-3 (Pending): Blue
 * - Approved: Green
 * - Rejected: Red
 */
export function WorkflowStatusBadge({ status }: WorkflowStatusBadgeProps) {
  // Determine badge variant and display text based on status
  const getBadgeConfig = (status: string) => {
    switch (status) {
      case WorkflowStatus.DRAFT:
        return {
          variant: "secondary" as const,
          text: "Draft",
        };
      case WorkflowStatus.STAGE1:
        return {
          variant: "default" as const,
          text: "Stage 1 (Pending)",
        };
      case WorkflowStatus.STAGE2:
        return {
          variant: "default" as const,
          text: "Stage 2 (Pending)",
        };
      case WorkflowStatus.STAGE3:
        return {
          variant: "default" as const,
          text: "Stage 3 (Pending)",
        };
      case WorkflowStatus.APPROVED:
        return {
          variant: "success" as const,
          text: "Approved",
        };
      case WorkflowStatus.REJECTED:
        return {
          variant: "destructive" as const,
          text: "Rejected",
        };
      default:
        return {
          variant: "secondary" as const,
          text: status,
        };
    }
  };

  const config = getBadgeConfig(status);

  return <Badge variant={config.variant}>{config.text}</Badge>;
}
