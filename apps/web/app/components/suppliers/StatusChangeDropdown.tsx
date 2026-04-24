import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useRouteLoaderData } from "react-router";
import type { AppLoaderData } from "~/routes/_app";
import { StatusChangeConfirmModal } from "./StatusChangeConfirmModal";
import type { SupplierStatus } from "@supplex/types";
import { Badge } from "~/components/ui/badge";

interface SupplierStatusOption {
  id: string;
  name: string;
}

interface StatusChangeDropdownProps {
  currentStatus: SupplierStatus;
  supplierId: string;
  supplierName: string;
  supplierStatuses?: SupplierStatusOption[];
}

const FALLBACK_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "prospect", label: "Prospect" },
  { value: "qualified", label: "Qualified" },
  { value: "approved", label: "Approved" },
  { value: "conditional", label: "Conditional" },
  { value: "blocked", label: "Blocked" },
];

export function StatusChangeDropdown({
  currentStatus,
  supplierId,
  supplierName,
  supplierStatuses,
}: StatusChangeDropdownProps) {
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
  const permissions = appData?.permissions;

  const [selectedStatus, setSelectedStatus] = useState<SupplierStatus | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use tenant-provided statuses if available, otherwise fall back to hardcoded
  const statusOptions =
    supplierStatuses && supplierStatuses.length > 0
      ? supplierStatuses.map((s) => ({
          value: s.name as SupplierStatus,
          label: s.name.charAt(0).toUpperCase() + s.name.slice(1),
        }))
      : FALLBACK_OPTIONS.map((o) => ({
          value: o.value as SupplierStatus,
          label: o.label,
        }));

  // Non-admin users only see a read-only badge
  if (!permissions?.canEditSuppliers) {
    const label =
      statusOptions.find((o) => o.value === currentStatus)?.label ||
      currentStatus;
    return <Badge variant="outline">{label}</Badge>;
  }

  const handleStatusSelect = (value: string) => {
    const newStatus = value as SupplierStatus;
    if (newStatus !== currentStatus) {
      setSelectedStatus(newStatus);
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedStatus(null);
  };

  const currentStatusLabel =
    statusOptions.find((opt) => opt.value === currentStatus)?.label ||
    currentStatus;

  return (
    <>
      <div className="flex items-center space-x-2">
        <label
          htmlFor="status-select"
          className="text-sm font-medium text-gray-700"
        >
          Change Status:
        </label>
        <Select value={currentStatus} onValueChange={handleStatusSelect}>
          <SelectTrigger id="status-select" className="w-[180px]">
            <SelectValue placeholder="Select status">
              {currentStatusLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedStatus && (
        <StatusChangeConfirmModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          supplierId={supplierId}
          supplierName={supplierName}
          oldStatus={currentStatus}
          newStatus={selectedStatus}
        />
      )}
    </>
  );
}
