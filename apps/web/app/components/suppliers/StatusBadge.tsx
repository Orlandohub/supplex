import { SupplierStatus } from "@supplex/types";

interface StatusBadgeProps {
  status: SupplierStatus;
}

const statusStyles: Record<SupplierStatus, string> = {
  [SupplierStatus.APPROVED]: "bg-green-100 text-green-800 border-green-200",
  [SupplierStatus.CONDITIONAL]: "bg-yellow-100 text-yellow-800 border-yellow-200",
  [SupplierStatus.BLOCKED]: "bg-red-100 text-red-800 border-red-200",
  [SupplierStatus.PROSPECT]: "bg-gray-100 text-gray-800 border-gray-200",
  [SupplierStatus.QUALIFIED]: "bg-blue-100 text-blue-800 border-blue-200",
};

const statusLabels: Record<SupplierStatus, string> = {
  [SupplierStatus.APPROVED]: "Approved",
  [SupplierStatus.CONDITIONAL]: "Conditional",
  [SupplierStatus.BLOCKED]: "Blocked",
  [SupplierStatus.PROSPECT]: "Prospect",
  [SupplierStatus.QUALIFIED]: "Qualified",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = statusStyles[status];
  const label = statusLabels[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles}`}
      role="status"
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}

