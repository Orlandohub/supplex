import { useState } from "react";
import { useRevalidator } from "@remix-run/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { useToast } from "~/hooks/use-toast";
import type { DocumentChecklist } from "@supplex/types";
import { AlertTriangle } from "lucide-react";

// Type for checklist data with dates as strings (after serialization)
type SerializedDocumentChecklist = Omit<
  DocumentChecklist,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklist: SerializedDocumentChecklist | null;
  token: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  checklist,
  token,
}: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!checklist) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.checklists[checklist.id].delete();

      // Check for errors
      if (response?.error) {
        // Check if it's a conflict error (template in use)
        if (response.status === 409) {
          setErrorMessage(
            "Cannot delete this template because it is currently in use by active qualification workflows."
          );
          setIsDeleting(false);
          return;
        }
        throw new Error("Failed to delete checklist template");
      }

      // Show success toast
      toast({
        title: "Template deleted",
        description: "The checklist template has been deleted successfully.",
        variant: "success",
      });

      // Revalidate data
      revalidator.revalidate();

      // Close dialog
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting checklist:", error);
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to delete checklist template. Please try again.",
        variant: "destructive",
      });
      setErrorMessage(
        error.message || "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setErrorMessage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <DialogTitle>Delete Checklist Template</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <DialogDescription className="py-4">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{checklist?.templateName}</span>? This
          action cannot be undone.
        </DialogDescription>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || !!errorMessage}
          >
            {isDeleting ? "Deleting..." : "Delete Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
