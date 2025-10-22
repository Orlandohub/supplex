import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePermissions } from "~/hooks/usePermissions";
import { StatusChangeConfirmModal } from "./StatusChangeConfirmModal";
import type { SupplierStatus } from "@supplex/types";

interface StatusChangeDropdownProps {
  currentStatus: SupplierStatus;
  supplierId: string;
  supplierName: string;
}

/**
 * Status options with labels
 */
const statusOptions: Array<{ value: SupplierStatus; label: string }> = [
  { value: "prospect", label: "Prospect" },
  { value: "qualified", label: "Qualified" },
  { value: "approved", label: "Approved" },
  { value: "conditional", label: "Conditional" },
  { value: "blocked", label: "Blocked" },
];

/**
 * Status Change Dropdown Component
 * 
 * Allows users with appropriate permissions to change supplier status
 * - Only visible to Admin and Procurement Manager roles
 * - Shows confirmation modal before submitting change
 * - Displays success/error notifications after submission
 */
export function StatusChangeDropdown({
  currentStatus,
  supplierId,
  supplierName,
}: StatusChangeDropdownProps) {
  const permissions = usePermissions();
  const [selectedStatus, setSelectedStatus] = useState<SupplierStatus | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only show to users with edit permissions
  if (!permissions.canEditSupplier) {
    return null;
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
        <label htmlFor="status-select" className="text-sm font-medium text-gray-700">
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

      {/* Confirmation Modal */}
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

