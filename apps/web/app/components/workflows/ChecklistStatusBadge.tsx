import { Badge } from "~/components/ui/badge";
import { ChecklistItemStatus } from "@supplex/types";
import { CheckCircle2, Circle, XCircle, Upload } from "lucide-react";

interface ChecklistStatusBadgeProps {
  status: ChecklistItemStatus;
}

/**
 * Checklist Status Badge Component
 * Displays color-coded status badges for workflow checklist items (AC 2)
 *
 * Status Colors and Icons:
 * - Pending: Gray badge, Circle icon, "Not Uploaded"
 * - Uploaded: Blue badge, Upload icon, "Uploaded (Pending Review)"
 * - Approved: Green badge, CheckCircle2 icon, "Approved"
 * - Rejected: Red badge, XCircle icon, "Rejected - Reupload Required"
 */
export function ChecklistStatusBadge({ status }: ChecklistStatusBadgeProps) {
  const getBadgeConfig = (status: ChecklistItemStatus) => {
    switch (status) {
      case ChecklistItemStatus.PENDING:
        return {
          variant: "secondary" as const,
          text: "Not Uploaded",
          icon: Circle,
          iconClassName: "h-3 w-3",
        };
      case ChecklistItemStatus.UPLOADED:
        return {
          variant: "default" as const,
          text: "Uploaded (Pending Review)",
          icon: Upload,
          iconClassName: "h-3 w-3",
        };
      case ChecklistItemStatus.APPROVED:
        return {
          variant: "success" as const,
          text: "Approved",
          icon: CheckCircle2,
          iconClassName: "h-3 w-3",
        };
      case ChecklistItemStatus.REJECTED:
        return {
          variant: "destructive" as const,
          text: "Rejected - Reupload Required",
          icon: XCircle,
          iconClassName: "h-3 w-3",
        };
      default:
        return {
          variant: "secondary" as const,
          text: status,
          icon: Circle,
          iconClassName: "h-3 w-3",
        };
    }
  };

  const config = getBadgeConfig(status);
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={config.iconClassName} />
      {config.text}
    </Badge>
  );
}
