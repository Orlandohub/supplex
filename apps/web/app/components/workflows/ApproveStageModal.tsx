/**
 * Approve Stage Modal
 * Confirmation modal for approving a workflow stage
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
import { useNavigate } from "@remix-run/react";
import { toast } from "sonner";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { CheckCircle, Loader2 } from "lucide-react";

interface ApproveStageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: any;
  stage: any;
  comments: string;
  token: string;
}

/**
 * Get risk badge variant based on risk score
 */
function getRiskBadgeVariant(
  score: number
): "default" | "secondary" | "destructive" {
  if (score >= 7) return "destructive";
  if (score >= 4) return "secondary";
  return "default";
}

export function ApproveStageModal({
  open,
  onOpenChange,
  workflow,
  stage,
  comments,
  token,
}: ApproveStageModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const navigate = useNavigate();

  const handleApprove = async () => {
    setIsApproving(true);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.workflows[workflow.id].stages[
        stage.id
      ].approve.post({
        comments: comments || undefined,
      });

      if (response?.error) {
        throw new Error(response.error.message || "Failed to approve stage");
      }

      toast.success("Stage 1 approved successfully", {
        description: `The workflow will advance to Stage 2: Quality Review.`,
      });

      // Navigate back to tasks page
      navigate("/tasks");
    } catch (error: unknown) {
      console.error("Approve error:", error);

      const errorMsg =
        error instanceof Error ? error.message : "Failed to approve stage";
      let errorMessage = errorMsg;

      if (errorMsg.includes("FORBIDDEN")) {
        errorMessage = "You are not authorized to approve this stage";
      } else if (errorMsg.includes("INVALID_STATE")) {
        errorMessage = "This stage has already been reviewed";
      } else if (errorMsg.includes("NOT_FOUND")) {
        errorMessage = "Stage not found";
      } else if (errorMsg.includes("NO_REVIEWER")) {
        errorMessage = "No reviewer available for Stage 2";
      }

      toast.error("Failed to approve stage", {
        description: errorMessage,
      });
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Approve Stage 1: Procurement Review?
          </DialogTitle>
          <DialogDescription>
            Review the details below before approving this stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Workflow Summary */}
          <div className="space-y-3">
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
                Risk Score
              </p>
              <Badge
                variant={getRiskBadgeVariant(workflow.riskScore || 0)}
                className="mt-1"
              >
                {workflow.riskScore?.toFixed(1) || "N/A"}
              </Badge>
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

          {/* Confirmation Text */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-900">
              <strong>
                This will advance the workflow to Stage 2: Quality Review.
              </strong>
              <br />
              The quality manager will be notified and can begin their review.
            </p>
          </div>

          {/* Review Comments (if provided) */}
          {comments && comments.trim().length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Your Comments
              </p>
              <div className="rounded-lg bg-muted p-3 text-sm">{comments}</div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApproving}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleApprove}
            disabled={isApproving}
            className="bg-green-600 hover:bg-green-700"
          >
            {isApproving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve & Advance
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
