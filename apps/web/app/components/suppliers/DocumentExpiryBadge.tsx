import { Badge } from "~/components/ui/badge";
import { AlertCircle, AlertTriangle } from "lucide-react";

interface DocumentExpiryBadgeProps {
  expiryDate: Date | string | null;
}

/**
 * Document Expiry Badge Component
 *
 * Displays expiration status for documents:
 * - Red badge: Expired documents
 * - Yellow badge: Documents expiring within 30 days
 * - No badge: No expiry date or expiry > 30 days
 *
 * Acceptance Criteria: AC #9, #10
 */
export function DocumentExpiryBadge({ expiryDate }: DocumentExpiryBadgeProps) {
  if (!expiryDate) {
    return null;
  }

  // Parse date if string
  const expiry =
    typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const today = new Date();

  // Calculate days until expiration
  const diffInMs = expiry.getTime() - today.getTime();
  const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  // Expired
  if (diffInDays < 0) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        <span>Expired</span>
      </Badge>
    );
  }

  // Expiring within 30 days
  if (diffInDays <= 30) {
    return (
      <Badge
        variant="default"
        className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600"
      >
        <AlertTriangle className="h-3 w-3" />
        <span>
          Expires in {diffInDays} {diffInDays === 1 ? "day" : "days"}
        </span>
      </Badge>
    );
  }

  // No badge for valid documents (expiry > 30 days)
  return null;
}
