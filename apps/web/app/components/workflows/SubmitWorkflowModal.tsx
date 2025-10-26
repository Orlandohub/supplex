/**
 * Submit Workflow Modal
 * Confirmation modal for submitting workflow for Stage 1 approval
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useRevalidator } from "@remix-run/react";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { AlertCircle, CheckCircle } from "lucide-react";
import type {
  QualificationWorkflowWithSupplier,
  WorkflowCompletionStatus,
} from "@supplex/types";

interface SubmitWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: QualificationWorkflowWithSupplier;
  completionStatus: WorkflowCompletionStatus;
  assignedReviewer?: { id: string; fullName: string; email: string };
  token: string;
}

/**
 * Get risk score badge variant based on numeric risk score
 * Low (< 3.5) = green, Medium (3.5-6.5) = yellow, High (> 6.5) = red
 */
function getRiskBadgeVariant(
  riskScore: string | null
): "success" | "warning" | "destructive" {
  if (!riskScore) return "success";
  const score = parseFloat(riskScore);
  if (score < 3.5) return "success"; // Low = green
  if (score <= 6.5) return "warning"; // Medium = yellow
  return "destructive"; // High = red
}

/**
 * Get risk level label based on numeric risk score
 */
function getRiskLabel(riskScore: string | null): string {
  if (!riskScore) return "Low";
  const score = parseFloat(riskScore);
  if (score < 3.5) return "Low";
  if (score <= 6.5) return "Medium";
  return "High";
}

export function SubmitWorkflowModal({
  open,
  onOpenChange,
  workflow,
  completionStatus,
  assignedReviewer,
  token,
}: SubmitWorkflowModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.workflows[workflow.id].submit.post();

      if (response?.error) {
        throw new Error(response.error.message || "Failed to submit workflow");
      }

      toast({
        title: "Workflow submitted successfully",
        description: `${workflow.supplier.name} qualification has been submitted for Stage 1 review.`,
      });

      revalidator.revalidate();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Submit error:", error);

      // Handle specific error codes
      const errorMsg =
        error instanceof Error ? error.message : "Failed to submit workflow";
      let errorMessage = errorMsg;
      if (errorMsg.includes("INCOMPLETE_DOCUMENTS")) {
        errorMessage =
          "All required documents must be uploaded before submission";
      } else if (errorMsg.includes("INVALID_STATUS")) {
        errorMessage = "Workflow must be in Draft status to submit";
      } else if (errorMsg.includes("FORBIDDEN")) {
        errorMessage = "You don't have permission to submit this workflow";
      }

      toast({
        title: "Submission failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit to Stage 1: Procurement Review?</DialogTitle>
          <DialogDescription>
            Please review the details below before submitting this qualification
            workflow for approval.
          </DialogDescription>
        </DialogHeader>

        {/* Workflow Summary */}
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Supplier:
            </span>
            <span className="text-sm font-semibold">
              {workflow.supplier.name}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Risk Score:
            </span>
            <Badge variant={getRiskBadgeVariant(workflow.riskScore)}>
              {getRiskLabel(workflow.riskScore)} ({workflow.riskScore || "0.00"}
              )
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Documents:
            </span>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold">
                {completionStatus.uploadedCount} of{" "}
                {completionStatus.requiredCount} required documents
              </span>
            </div>
          </div>

          {assignedReviewer && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Assigned Reviewer:
              </span>
              <span className="text-sm font-semibold">
                {assignedReviewer.fullName}
              </span>
            </div>
          )}
        </div>

        {/* Warning Message */}
        <div className="flex gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            Once submitted, you will not be able to edit documents or workflow
            details unless it is rejected.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit for Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
