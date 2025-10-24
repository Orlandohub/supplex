import { useState } from "react";
import { useRevalidator } from "@remix-run/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ChecklistForm } from "./ChecklistForm";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { useToast } from "~/hooks/useToast";
import type { DocumentChecklist } from "@supplex/types";

// Type for checklist data with dates as strings (after serialization)
type SerializedDocumentChecklist = Omit<
  DocumentChecklist,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

interface ChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  checklist?: SerializedDocumentChecklist;
  token: string;
}

export function ChecklistDialog({
  open,
  onOpenChange,
  mode,
  checklist,
  token,
}: ChecklistDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);

    try {
      const client = createClientEdenTreatyClient(token);

      let response;
      if (mode === "create") {
        // Create new checklist
        response = await client.api.checklists.post(data);
      } else if (mode === "edit" && checklist) {
        // Update existing checklist
        response = await client.api.checklists[checklist.id].put(data);
      }

      // Check for errors
      if (response?.error) {
        throw new Error("Failed to save checklist template");
      }

      // Show success toast
      toast({
        title: mode === "create" ? "Template created" : "Template updated",
        description:
          mode === "create"
            ? "The checklist template has been created successfully."
            : "The checklist template has been updated successfully.",
        variant: "success",
      });

      // Revalidate data
      revalidator.revalidate();

      // Close dialog
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving checklist:", error);
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to save checklist template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Create Checklist Template"
              : "Edit Checklist Template"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new document checklist template for qualification workflows."
              : "Update the checklist template details and required documents."}
          </DialogDescription>
        </DialogHeader>

        <ChecklistForm
          mode={mode}
          checklist={checklist}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
