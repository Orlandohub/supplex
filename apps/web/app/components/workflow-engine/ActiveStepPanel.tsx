/**
 * Active Step Panel Component
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * Displays active step details and action buttons
 */

import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { createEdenTreatyClient } from "~/lib/api-client";
import { useNavigate } from "react-router";

interface StepInstance {
  id: string;
  stepOrder: number;
  stepName: string;
  stepType: string;
  status: string;
  metadata: Record<string, any>;
}

interface TaskInstance {
  id: string;
  title: string;
  description?: string | null;
  assigneeType: string;
  status: string;
  dueAt?: string | null;
}

interface DocumentProgress {
  total: number;
  uploaded: number;
  approved: number;
  declined: number;
  pending: number;
  documents?: Array<{
    requiredDocumentName: string;
    status: string;
    declineComment?: string | null;
  }>;
}

interface RejectionComment {
  commentText: string;
  commenterFullName?: string | null;
  commenterEmail?: string | null;
  createdAt: string;
  entityType: string;
}

interface ActiveStepPanelProps {
  step: StepInstance;
  userTasks: TaskInstance[];
  processId: string;
  token: string;
  formSubmission?: any;
  documentProgress?: DocumentProgress | null;
  processStatus?: string;
  stepComments?: RejectionComment[];
}

export function ActiveStepPanel({
  step,
  userTasks,
  processId,
  token,
  formSubmission,
  documentProgress,
  processStatus = "",
  stepComments = [],
}: ActiveStepPanelProps) {
  const navigate = useNavigate();
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineComment, setDeclineComment] = useState("");

  const client = createEdenTreatyClient(token);

  // Check step type and status
  const isAwaitingValidation = step.status === "awaiting_validation";
  const isApprovalStep = step.stepType === "approval";
  const isReviewStep = step.stepType === "review";
  const isFormStep = step.stepType === "form";
  const isDocumentStep =
    step.stepType === "document" || step.stepType === "document_upload";
  const hasUserTasks = userTasks.length > 0;
  const allTasksCompleted = userTasks.every((t) => t.status === "completed");

  // Detect if this step was previously rejected/declined
  const wasRejected = processStatus === "declined_resubmit";
  const latestRejectionComment = wasRejected
    ? stepComments
        .filter((c) => c.entityType === "form" || c.entityType === "document")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0]
    : null;

  // For form steps, check if form is submitted
  const formStatus = formSubmission?.status;
  const isFormSubmitted = formStatus === "submitted";
  const isFormDraft = formStatus === "draft";
  const canCompleteFormStep = isFormStep && isFormSubmitted;

  const handleCompleteStep = async () => {
    if (isCompleting) return;
    try {
      setIsCompleting(true);
      setError(null);

      const action = isAwaitingValidation
        ? "approve"
        : isFormStep
          ? "submit"
          : "approve";

      const response = await (client.api.workflows.steps as any)[
        step.id
      ].complete.post({
        action,
      });

      if (response.error) {
        setError(response.error.message || "Failed to complete step");
        setIsCompleting(false);
        return;
      }

      navigate(".", { replace: true });
    } catch (err) {
      setError("An unexpected error occurred");
      setIsCompleting(false);
      console.error("Error completing step:", err);
    }
  };

  const handleDeclineStep = async () => {
    if (isCompleting) return;
    if (!declineComment.trim()) {
      setError("Please provide a reason for declining.");
      return;
    }

    try {
      setIsCompleting(true);
      setError(null);

      const response = await (client.api.workflows.steps as any)[
        step.id
      ].complete.post({
        action: "decline",
        comment: declineComment.trim(),
      });

      if (response.error) {
        setError(response.error.message || "Failed to decline step");
        setIsCompleting(false);
        return;
      }

      setShowDeclineForm(false);
      setDeclineComment("");
      navigate(".", { replace: true });
    } catch (err) {
      setError("An unexpected error occurred");
      setIsCompleting(false);
      console.error("Error declining step:", err);
    }
  };

  const handleFillForm = () => {
    navigate(`/workflows/processes/${processId}/steps/${step.id}/form`);
  };

  const handleUploadDocuments = () => {
    navigate(`/workflows/processes/${processId}/steps/${step.id}/documents`);
  };

  const handleReviewDocuments = () => {
    navigate(`/workflows/processes/${processId}/steps/${step.id}/documents`);
  };

  const handleReviewForm = () => {
    if (formSubmission?.id) {
      navigate(`/forms/${formSubmission.id}`);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {step.status === "awaiting_validation"
              ? `Validation: ${step.stepName}`
              : `Current Step: ${step.stepName}`}
          </h2>
          <p className="text-sm text-gray-500 mt-1">Step {step.stepOrder}</p>
        </div>
        <Badge
          className={
            step.status === "awaiting_validation"
              ? "bg-amber-100 text-amber-800"
              : "bg-blue-100 text-blue-800"
          }
        >
          {step.status === "awaiting_validation"
            ? "Awaiting Validation"
            : "Active"}
        </Badge>
      </div>

      {/* Rejection Banner */}
      {wasRejected && !isAwaitingValidation && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start space-x-3">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Previous submission was declined
              </p>
              {latestRejectionComment && (
                <div className="mt-2">
                  <p className="text-sm text-red-700 italic">
                    &ldquo;{latestRejectionComment.commentText}&rdquo;
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    by{" "}
                    {latestRejectionComment.commenterFullName ||
                      latestRejectionComment.commenterEmail ||
                      "Reviewer"}{" "}
                    on{" "}
                    {new Date(
                      latestRejectionComment.createdAt
                    ).toLocaleString()}
                  </p>
                </div>
              )}
              <p className="text-xs text-red-600 mt-2">
                Please address the feedback and resubmit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {hasUserTasks && (
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Your Tasks</h3>
          <div className="space-y-2">
            {userTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start justify-between p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <p className="font-medium text-gray-900">{task.title}</p>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {task.description}
                    </p>
                  )}
                  {task.dueAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Due: {new Date(task.dueAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge
                  className={
                    task.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }
                >
                  {task.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      {hasUserTasks && (
        <div className="space-y-4">
          {/* Validation Step Actions â€” single button to review the form (form steps only) */}
          {isAwaitingValidation && !isDocumentStep && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm font-medium text-amber-900">
                  This step requires your validation review. Open the form to
                  approve or decline.
                </p>
              </div>

              <Button
                onClick={handleReviewForm}
                disabled={!formSubmission}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                Review Form Submission
              </Button>

              {!formSubmission && (
                <p className="text-sm text-gray-500 text-center">
                  No form submission found for this step.
                </p>
              )}
            </div>
          )}

          {/* Form Step Actions */}
          {isFormStep && !isAwaitingValidation && (
            <div className="space-y-4">
              {/* Form Status Display */}
              {formSubmission && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Form Status
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {isFormSubmitted && "âœ… Form has been submitted"}
                      {isFormDraft && "ðŸ“ Form saved as draft"}
                    </p>
                  </div>
                  <Badge
                    className={
                      isFormSubmitted
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {formStatus}
                  </Badge>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-4">
                <Button
                  onClick={handleFillForm}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {formSubmission
                    ? isFormSubmitted
                      ? "ðŸ“„ View Form"
                      : "ðŸ“ Edit Form"
                    : "ðŸ“ Fill Out Form"}
                </Button>
                {canCompleteFormStep && (
                  <Button
                    onClick={handleCompleteStep}
                    disabled={isCompleting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isCompleting ? "Processing..." : "âœ“ Complete Step"}
                  </Button>
                )}
                {!canCompleteFormStep && (
                  <p className="text-sm text-gray-500">
                    {formSubmission
                      ? "Submit the form before completing this step"
                      : "Fill out and submit the form to continue"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Approval/Review Step Actions */}
          {(isApprovalStep || isReviewStep) && (
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleCompleteStep}
                disabled={isCompleting || !allTasksCompleted}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCompleting ? "Processing..." : "Approve & Continue"}
              </Button>
              <Button
                onClick={handleDeclineStep}
                disabled={isCompleting}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                {isCompleting ? "Processing..." : "Decline"}
              </Button>
              {!allTasksCompleted && (
                <p className="text-sm text-gray-500">
                  Complete all tasks before proceeding
                </p>
              )}
            </div>
          )}

          {/* Document Step Actions */}
          {isDocumentStep && !isAwaitingValidation && (
            <div className="space-y-4">
              {documentProgress && documentProgress.declined > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start space-x-3">
                    <svg
                      className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800">
                        {documentProgress.declined} of {documentProgress.total}{" "}
                        document(s) were declined
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Please re-upload the declined documents to proceed.
                      </p>
                      {documentProgress.documents && (
                        <ul className="mt-2 space-y-1">
                          {documentProgress.documents
                            .filter((d) => d.status === "declined")
                            .map((d, idx) => (
                              <li key={idx} className="text-sm text-red-700">
                                <span className="font-medium">
                                  {d.requiredDocumentName}
                                </span>
                                {d.declineComment && (
                                  <span className="italic text-red-600">
                                    {" "}
                                    &mdash; &ldquo;{d.declineComment}&rdquo;
                                  </span>
                                )}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {documentProgress && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">
                      Document Progress
                    </p>
                    <Badge
                      className={
                        documentProgress.uploaded +
                          documentProgress.approved ===
                        documentProgress.total
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {documentProgress.uploaded + documentProgress.approved}/
                      {documentProgress.total}
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${((documentProgress.uploaded + documentProgress.approved) / Math.max(documentProgress.total, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <Button
                onClick={handleUploadDocuments}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Upload Documents
              </Button>
            </div>
          )}

          {/* Document Validation Actions */}
          {isDocumentStep && isAwaitingValidation && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm font-medium text-amber-900">
                  Review the uploaded documents. You can approve or decline each
                  document individually.
                </p>
              </div>
              <Button
                onClick={handleReviewDocuments}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                Review Documents
              </Button>
            </div>
          )}

          {/* Other Step Types */}
          {!isApprovalStep &&
            !isReviewStep &&
            !isFormStep &&
            !isDocumentStep && (
              <div className="flex items-center space-x-4">
                <Button
                  onClick={handleCompleteStep}
                  disabled={isCompleting || !allTasksCompleted}
                >
                  {isCompleting ? "Processing..." : "Complete Step"}
                </Button>
                {!allTasksCompleted && (
                  <p className="text-sm text-gray-500">
                    Complete all tasks before proceeding
                  </p>
                )}
              </div>
            )}
        </div>
      )}

      {!hasUserTasks && (
        <div className="text-center py-4">
          <p className="text-gray-500">
            This step is assigned to another user or role
          </p>
        </div>
      )}
    </Card>
  );
}
