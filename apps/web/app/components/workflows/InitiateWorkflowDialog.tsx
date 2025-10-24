import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { InitiateWorkflowForm } from "./InitiateWorkflowForm";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { useRevalidator } from "@remix-run/react";
import { useToast } from "~/hooks/useToast";
import type { DocumentChecklist } from "@supplex/types";

interface WorkflowFormData {
  supplierId: string;
  checklistId: string;
  riskAssessment: {
    geographic: string;
    financial: string;
    quality: string;
    delivery: string;
  };
  notes?: string;
}

interface InitiateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: {
    id: string;
    name: string;
  };
  token: string;
}

/**
 * Initiate Workflow Dialog Component (AC 2-3)
 * Modal dialog for initiating a qualification workflow
 *
 * Features:
 * - Fetches available checklist templates
 * - Displays supplier name
 * - Handles form submission
 * - Shows loading state
 * - Revalidates page on success
 */
export function InitiateWorkflowDialog({
  open,
  onOpenChange,
  supplier,
  token,
}: InitiateWorkflowDialogProps) {
  const [checklists, setChecklists] = useState<DocumentChecklist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const revalidator = useRevalidator();
  const { toast } = useToast();

  // Fetch checklists when dialog opens
  useEffect(() => {
    if (open) {
      fetchChecklists();
    }
  }, [open]);

  const fetchChecklists = async () => {
    setIsLoading(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.checklists.get();

      if (response.error) {
        throw new Error("Failed to load checklist templates");
      }

      const apiResponse = response.data as {
        success: boolean;
        data: {
          checklists: DocumentChecklist[];
        };
      };

      setChecklists(apiResponse.data.checklists || []);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load checklist templates";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      console.error("Error fetching checklists:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: WorkflowFormData) => {
    setIsSubmitting(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.workflows.initiate.post(data);

      if (response.error) {
        const errorData = response.error as {
          value?: { error?: { message?: string }; message?: string };
        };
        throw new Error(
          errorData.value?.error?.message ||
            errorData.value?.message ||
            "Failed to initiate workflow"
        );
      }

      // Success toast (AC 10)
      toast({
        title: `Qualification workflow initiated for ${supplier.name}`,
        variant: "success",
      });

      // Revalidate to refresh workflows list
      revalidator.revalidate();

      // Close dialog
      onOpenChange(false);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initiate workflow";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Initiate Qualification Workflow</DialogTitle>
          <DialogDescription>
            Start a formal qualification process for {supplier.name}
          </DialogDescription>
        </DialogHeader>

        <InitiateWorkflowForm
          supplier={supplier}
          checklists={checklists}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
