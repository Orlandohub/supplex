import { Link, Form } from "@remix-run/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface Duplicate {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  taxId: string;
  category: string;
  status: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  website?: string;
  notes?: string;
}

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: Duplicate[];
  formData: FormData;
  onSaveAnyway: () => void;
}

/**
 * DuplicateWarningModal Component
 * Displays warning when creating a supplier with a name similar to existing suppliers
 *
 * Features:
 * - Shows list of potential duplicate suppliers
 * - Links to view existing suppliers
 * - "Save Anyway" button to override duplicate detection
 * - Accessible with proper ARIA labels and keyboard controls
 */
export function DuplicateWarningModal({
  isOpen,
  onClose,
  duplicates,
  formData,
  onSaveAnyway,
}: DuplicateWarningModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Potential Duplicate Supplier</DialogTitle>
          <DialogDescription>
            A supplier with a similar name already exists. Please review the
            following existing suppliers before continuing.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm font-medium text-gray-900 mb-2">
            Existing suppliers:
          </p>
          <ul className="space-y-2">
            {duplicates.map((duplicate) => (
              <li
                key={duplicate.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <span className="text-sm text-gray-700">{duplicate.name}</span>
                <Link
                  to={`/suppliers/${duplicate.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Form method="post">
            {/* Hidden inputs to preserve all form data */}
            <input type="hidden" name="forceSave" value="true" />
            <input type="hidden" name="name" value={formData.name} />
            <input type="hidden" name="taxId" value={formData.taxId} />
            <input type="hidden" name="category" value={formData.category} />
            <input type="hidden" name="status" value={formData.status} />
            <input
              type="hidden"
              name="contactName"
              value={formData.contactName}
            />
            <input
              type="hidden"
              name="contactEmail"
              value={formData.contactEmail}
            />
            {formData.contactPhone && (
              <input
                type="hidden"
                name="contactPhone"
                value={formData.contactPhone}
              />
            )}
            <input
              type="hidden"
              name="address.street"
              value={formData.address.street}
            />
            <input
              type="hidden"
              name="address.city"
              value={formData.address.city}
            />
            <input
              type="hidden"
              name="address.state"
              value={formData.address.state}
            />
            <input
              type="hidden"
              name="address.postalCode"
              value={formData.address.postalCode}
            />
            <input
              type="hidden"
              name="address.country"
              value={formData.address.country}
            />
            {formData.website && (
              <input type="hidden" name="website" value={formData.website} />
            )}
            {formData.notes && (
              <input type="hidden" name="notes" value={formData.notes} />
            )}
            <Button type="submit" onClick={onSaveAnyway}>
              Save Anyway
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
