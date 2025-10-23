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
import { AlertTriangle } from "lucide-react";

interface DeleteSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId?: string;
  supplierName: string;
}

/**
 * Delete Supplier Confirmation Modal
 *
 * Displays a confirmation dialog before deleting a supplier
 * - Warns about soft delete (data preserved for audit)
 * - Requires explicit confirmation
 * - Submits via Remix form action
 * - Redirects to supplier list after successful deletion
 */
export function DeleteSupplierModal({
  isOpen,
  onClose,
  supplierId: _supplierId,
  supplierName,
}: DeleteSupplierModalProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span>Delete Supplier</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{supplierName}&quot;?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-md space-y-2">
            <p className="text-sm text-red-800 font-medium">
              This action cannot be easily undone.
            </p>
            <p className="text-sm text-red-700">
              The supplier will be archived and removed from your active
              supplier list. Historical data will be preserved for audit
              purposes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? "Deleting..." : "Delete Supplier"}
              </Button>
            </div>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
