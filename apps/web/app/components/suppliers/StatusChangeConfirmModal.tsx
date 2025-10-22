import { Form, useNavigation } from "@remix-run/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import type { SupplierStatus } from "@supplex/types";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface StatusChangeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  oldStatus: SupplierStatus;
  newStatus: SupplierStatus;
}

/**
 * Status labels map
 */
const statusLabels: Record<SupplierStatus, string> = {
  prospect: "Prospect",
  qualified: "Qualified",
  approved: "Approved",
  conditional: "Conditional",
  blocked: "Blocked",
};

/**
 * Status Change Confirmation Modal
 * 
 * Displays a confirmation dialog before changing supplier status
 * - Shows old status → new status transition
 * - Requires explicit confirmation
 * - Submits via Remix form action
 * - Shows success/error toast notifications
 */
export function StatusChangeConfirmModal({
  isOpen,
  onClose,
  supplierId,
  supplierName,
  oldStatus,
  newStatus,
}: StatusChangeConfirmModalProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span>Confirm Status Change</span>
          </DialogTitle>
          <DialogDescription>
            You are about to change the status for "{supplierName}".
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-center space-x-4">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Current Status</p>
              <div className="px-4 py-2 bg-gray-100 rounded-md">
                <p className="font-semibold text-gray-900">
                  {statusLabels[oldStatus]}
                </p>
              </div>
            </div>

            <ArrowRight className="h-6 w-6 text-gray-400" />

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">New Status</p>
              <div className="px-4 py-2 bg-blue-100 rounded-md">
                <p className="font-semibold text-blue-900">
                  {statusLabels[newStatus]}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              This change will be recorded in the supplier's audit history.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Form method="post" onSubmit={onClose}>
            <input type="hidden" name="intent" value="update-status" />
            <input type="hidden" name="status" value={newStatus} />
            <div className="flex space-x-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                {isSubmitting ? "Updating..." : "Confirm Change"}
              </Button>
            </div>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

