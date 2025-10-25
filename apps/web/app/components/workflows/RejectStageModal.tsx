/**
 * Reject Stage Modal
 * Form modal for rejecting a workflow stage with required comments
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
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useNavigate } from "@remix-run/react";
import { toast } from "sonner";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { AlertCircle, Loader2, XCircle } from "lucide-react";

interface RejectStageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: any;
  stage: any;
  initialComments?: string;
  token: string;
}

export function RejectStageModal({
  open,
  onOpenChange,
  workflow,
  stage,
  initialComments = "",
  token,
}: RejectStageModalProps) {
  const [rejectionComments, setRejectionComments] = useState(initialComments);
  const [isRejecting, setIsRejecting] = useState(false);
  const navigate = useNavigate();

  // Validation
  const commentsValid = rejectionComments.trim().length >= 10;
  const charCount = rejectionComments.trim().length;

  const handleReject = async () => {
    // Validate comments
    if (!commentsValid) {
      toast.error("Validation error", {
        description: "Rejection comments must be at least 10 characters",
      });
      return;
    }

    setIsRejecting(true);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.workflows[workflow.id].stages[
        stage.id
      ].reject.post({
        comments: rejectionComments.trim(),
      });

      if (response?.error) {
        throw new Error(response.error.message || "Failed to reject stage");
      }

      toast.success("Changes requested successfully", {
        description: `The workflow has been returned to the initiator for revisions.`,
      });

      // Navigate back to tasks page
      navigate("/tasks");
    } catch (error: unknown) {
      console.error("Reject error:", error);

      const errorMsg =
        error instanceof Error ? error.message : "Failed to reject stage";
      let errorMessage = errorMsg;

      if (errorMsg.includes("VALIDATION_ERROR")) {
        errorMessage = "Rejection comments required (minimum 10 characters)";
      } else if (errorMsg.includes("FORBIDDEN")) {
        errorMessage = "You are not authorized to reject this stage";
      } else if (errorMsg.includes("INVALID_STATE")) {
        errorMessage = "This stage has already been reviewed";
      } else if (errorMsg.includes("NOT_FOUND")) {
        errorMessage = "Stage not found";
      }

      toast.error("Failed to reject stage", {
        description: errorMessage,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Request Changes for Stage 1
          </DialogTitle>
          <DialogDescription>
            Explain what needs to be corrected or improved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Message */}
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-900">
                This will return the workflow to Draft status
              </p>
              <p className="text-sm text-yellow-800">
                The initiator will need to address your feedback and resubmit
                the workflow for review.
              </p>
            </div>
          </div>

          {/* Workflow Info */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Supplier
              </p>
              <p className="text-base font-semibold">
                {workflow.supplier?.name || "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Current Stage
              </p>
              <p className="text-base">
                Stage {stage.stageNumber}: {stage.stageName}
              </p>
            </div>
          </div>

          {/* Rejection Comments Form */}
          <div className="space-y-2">
            <Label htmlFor="rejection-comments" className="required">
              Rejection Comments *
            </Label>
            <Textarea
              id="rejection-comments"
              placeholder="Explain what needs to be corrected or improved..."
              value={rejectionComments}
              onChange={(e) => setRejectionComments(e.target.value)}
              rows={6}
              className={`w-full ${!commentsValid && charCount > 0 ? "border-destructive" : ""}`}
            />
            <div className="flex justify-between items-center text-sm">
              <span
                className={
                  commentsValid
                    ? "text-muted-foreground"
                    : "text-destructive font-medium"
                }
              >
                {commentsValid ? (
                  `${charCount} characters`
                ) : (
                  <>
                    <AlertCircle className="inline h-3 w-3 mr-1" />
                    Minimum 10 characters required
                  </>
                )}
              </span>
              {commentsValid && (
                <span className="text-green-600 flex items-center gap-1">
                  ✓ Valid
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRejecting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isRejecting || !commentsValid}
          >
            {isRejecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Request Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
