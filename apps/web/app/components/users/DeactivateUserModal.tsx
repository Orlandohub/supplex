/**
 * DeactivateUserModal Component
 * Confirmation modal for deactivating/reactivating users
 */

import { useState } from "react";
import type { User } from "@supplex/types";
import { getErrorMessage } from "~/lib/api-helpers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { AlertCircle, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export interface DeactivateUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: string, isActive: boolean) => Promise<void>;
}

export function DeactivateUserModal({
  isOpen,
  user,
  onClose,
  onConfirm,
}: DeactivateUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!user) return;

    setError(null);
    setIsSubmitting(true);

    try {
      // Toggle the user's active status
      await onConfirm(user.id, !user.isActive);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update user status"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  const isDeactivating = user.isActive;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              isDeactivating ? "bg-red-100" : "bg-green-100"
            }`}
          >
            {isDeactivating ? (
              <XCircle className="h-6 w-6 text-red-600" />
            ) : (
              <CheckCircle className="h-6 w-6 text-green-600" />
            )}
          </div>
          <DialogTitle className="text-center">
            {isDeactivating ? "Deactivate User" : "Reactivate User"}
          </DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to{" "}
            {isDeactivating ? "deactivate" : "reactivate"}{" "}
            <span className="font-medium">{user.fullName}</span> ({user.email})?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-md bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {isDeactivating && (
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-800">
                    Warning
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-yellow-700 list-disc list-inside">
                    <li>
                      The user will be immediately logged out and unable to
                      access the system
                    </li>
                    <li>All their data and history will be preserved</li>
                    <li>You can reactivate this user at any time</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isDeactivating ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isDeactivating
                ? "Deactivating..."
                : "Reactivating..."
              : isDeactivating
                ? "Deactivate"
                : "Reactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
