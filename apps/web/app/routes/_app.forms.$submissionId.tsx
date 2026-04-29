/**
 * Form Execution Page
 * View and edit form submissions
 * Story: 2.2.4 - Form Runtime Execution with Save Draft
 * Updated: Story 2.2.14 - Uses formTemplateId instead of versionId
 */

import { data as json, type LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useNavigate,
  useRevalidator,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/require-auth";
import {
  createEdenTreatyClient,
  createClientEdenTreatyClient,
} from "~/lib/api-client";
import { errorBody } from "~/lib/api-helpers";
import type {
  FormSubmission,
  FormTemplateWithStructureUI,
  FormAnswer,
} from "@supplex/types";
import { ArrowLeft } from "lucide-react";
import { FormRenderer } from "~/components/form-runtime/FormRenderer";
import { useFormSubmission } from "~/hooks/useFormSubmission";
import { useToast } from "~/hooks/use-toast";

export async function loader(args: LoaderFunctionArgs) {
  const { params, request } = args;

  // Require authentication
  const { session } = await requireAuth(args);

  // Get submission ID from URL params
  const { submissionId } = params;
  if (!submissionId) {
    throw new Response("Submission ID is required", { status: 400 });
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Create Eden Treaty client
  const client = createEdenTreatyClient(token);

  try {
    // Fetch submission with answers and form structure
    const submissionResponse = await client.api["form-submissions"]({
      submissionId,
    }).get();

    if (submissionResponse.error) {
      const status = submissionResponse.status || 500;
      if (status === 404) {
        throw new Response("Submission not found", { status: 404 });
      }
      if (status === 403) {
        throw new Response(
          "You don't have permission to view this submission",
          { status: 403 }
        );
      }
      throw new Response("Failed to load submission", { status });
    }

    // Trust-boundary cast via `unknown`: API returns `Date` fields, the
    // local `FormSubmission`/`FormAnswer` types use post-serialization
    // strings.
    const submissionPayload = submissionResponse.data as unknown as {
      success: boolean;
      data: {
        submission: FormSubmission;
        formTemplate: FormTemplateWithStructureUI & { name?: string };
        answers: FormAnswer[];
        formStructure: { sections: FormTemplateWithStructureUI["sections"] };
        isReadOnly?: boolean;
        canValidate?: boolean;
      };
    } | null;
    if (!submissionPayload?.data) {
      throw new Response("Invalid API response", { status: 500 });
    }
    const data = submissionPayload.data;
    const submission = data.submission;
    const formTemplate = data.formTemplate;
    const answers = data.answers;
    const formStructure = data.formStructure;
    const isReadOnly = data.isReadOnly ?? false;
    const canValidate = data.canValidate ?? false;

    const formVersion: FormTemplateWithStructureUI & { name?: string } = {
      ...formTemplate,
      sections: formStructure.sections,
    };

    // Fetch workflow context in parallel (non-blocking)
    let workflowContext: {
      processInstanceId: string;
      workflowName: string;
      stepName: string;
    } | null = null;

    if (submission.processInstanceId) {
      try {
        const processResponse = await client.api.workflows
          .processes({
            processInstanceId: submission.processInstanceId,
          })
          .get();
        if (!processResponse.error) {
          // Narrow the process payload to the fields we read here. We
          // intentionally don't import the full ProcessInstance contract
          // because this loader only consumes a couple of strings.
          const processBody = processResponse.data as unknown as {
            success: boolean;
            data?: {
              process?: { workflowName?: string; processType?: string };
              steps?: Array<{ id: string; stepName?: string }>;
            };
          } | null;
          const processData = processBody?.data;
          const process = processData?.process;
          const steps = processData?.steps ?? [];
          const currentStep = steps.find(
            (s) => s.id === submission.stepInstanceId
          );
          workflowContext = {
            processInstanceId: submission.processInstanceId,
            workflowName:
              process?.workflowName ||
              process?.processType?.replace(/_/g, " ") ||
              "Workflow",
            stepName: currentStep?.stepName || "Form Step",
          };
        }
      } catch {
        // Non-blocking — fall back to default breadcrumbs
      }
    }

    const url = new URL(request.url);
    const fromSupplier = url.searchParams.get("from") === "supplier";
    const supplierContext = fromSupplier
      ? {
          supplierId: url.searchParams.get("supplierId") || "",
          supplierName: url.searchParams.get("supplierName") || "Supplier",
        }
      : null;

    return json({
      submission,
      formVersion,
      answers,
      token,
      workflowContext,
      isReadOnly,
      canValidate,
      supplierContext,
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("Error fetching form submission:", error);
    throw new Response("Failed to load submission", { status: 500 });
  }
}

export default function FormExecutionPage() {
  const {
    submission,
    formVersion,
    answers,
    token,
    workflowContext,
    isReadOnly,
    canValidate,
    supplierContext,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { toast } = useToast();
  const isSupplierContext = !!supplierContext;
  const isWorkflowContext = !!workflowContext && !isSupplierContext;
  const isValidator = canValidate && isWorkflowContext;

  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineComment, setDeclineComment] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { saveDraft, submitForm } = useFormSubmission({
    token,
    onSaveSuccess: () => {
      revalidator.revalidate();
    },
    onSubmitSuccess: (processInstanceId) => {
      if (processInstanceId) {
        navigate(`/workflows/processes/${processInstanceId}`);
      } else {
        revalidator.revalidate();
      }
    },
  });

  const handleSave = async (answersMap: Map<string, string>) => {
    await saveDraft(
      submission.formTemplateId,
      answersMap,
      submission.processInstanceId,
      submission.stepInstanceId
    );
  };

  const handleSubmit = async (answersMap: Map<string, string>) => {
    const saveResult = await saveDraft(
      submission.formTemplateId,
      answersMap,
      submission.processInstanceId,
      submission.stepInstanceId,
      true
    );

    if (saveResult.success) {
      await submitForm(submission.id);
    }
  };

  const handleApprove = async () => {
    if (!submission.stepInstanceId || isProcessing) return;
    setIsProcessing(true);
    setValidationError(null);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.workflows
        .steps({
          stepInstanceId: submission.stepInstanceId,
        })
        .complete.post({
          action: "approve",
        });
      if (response.error) {
        const errBody = errorBody(response.error);
        setValidationError(errBody?.error.message || "Failed to approve");
        setIsProcessing(false);
        return;
      }
      toast({
        title: "Approved",
        description: "Form submission has been approved.",
      });
      navigate(`/workflows/processes/${workflowContext!.processInstanceId}`);
    } catch (err) {
      setValidationError("An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!submission.stepInstanceId || !declineComment.trim() || isProcessing)
      return;
    setIsProcessing(true);
    setValidationError(null);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.workflows
        .steps({
          stepInstanceId: submission.stepInstanceId,
        })
        .complete.post({
          action: "decline",
          comment: declineComment.trim(),
        });
      if (response.error) {
        const errBody = errorBody(response.error);
        setValidationError(errBody?.error.message || "Failed to decline");
        setIsProcessing(false);
        return;
      }
      toast({
        title: "Declined",
        description: "Form submission has been declined.",
      });
      navigate(`/workflows/processes/${workflowContext!.processInstanceId}`);
    } catch (err) {
      setValidationError("An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  const mode =
    submission.status === "submitted" || isReadOnly ? "view" : "edit";

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(
              isSupplierContext
                ? `/suppliers/${supplierContext!.supplierId}`
                : isWorkflowContext
                  ? `/workflows/processes/${workflowContext!.processInstanceId}`
                  : "/forms"
            )
          }
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isSupplierContext
            ? "Back to Supplier"
            : isWorkflowContext
              ? "Back to Workflow"
              : "Back to Forms"}
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isSupplierContext
              ? `${supplierContext!.supplierName} — ${formVersion.name || "Form"}`
              : isValidator
                ? "Review Form Submission"
                : mode === "view"
                  ? "View Form Submission"
                  : "Fill Form"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isSupplierContext
              ? "Submitted form json(read-only)"
              : isValidator
                ? "Review the submission below, then approve or decline."
                : mode === "view"
                  ? "This form has been submitted"
                  : "Save your progress as you go, submit when complete"}
          </p>
        </div>
      </div>

      {/* Validator banner */}
      {isValidator && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-900">
            You are reviewing this form as a validator. Use the buttons at the
            bottom to approve or decline.
          </p>
        </div>
      )}

      {/* Form Renderer */}
      <FormRenderer
        formVersion={formVersion}
        initialAnswers={answers}
        mode={mode}
        onSave={mode === "edit" ? handleSave : undefined}
        onSubmit={mode === "edit" ? handleSubmit : undefined}
      />

      {/* Validation Actions (shown at the bottom after the form) */}
      {isValidator && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 rounded-lg shadow-lg space-y-4">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{validationError}</p>
            </div>
          )}

          {showDeclineForm ? (
            <div className="space-y-3">
              <label
                htmlFor="decline-reason"
                className="block text-sm font-medium text-gray-900"
              >
                Reason for declining
              </label>
              <textarea
                id="decline-reason"
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                placeholder="Please explain why this submission is being declined..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleDecline}
                  disabled={isProcessing || !declineComment.trim()}
                  variant="destructive"
                >
                  {isProcessing ? "Processing..." : "Confirm Decline"}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeclineForm(false);
                    setDeclineComment("");
                    setValidationError(null);
                  }}
                  variant="ghost"
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Button
                onClick={handleApprove}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
              >
                {isProcessing ? "Processing..." : "Approve Submission"}
              </Button>
              <Button
                onClick={() => setShowDeclineForm(true)}
                disabled={isProcessing}
                variant="outline"
                className="border-red-600 text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
              >
                Decline
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  if (isRouteErrorResponse(error)) {
    const is403 = error.status === 403;
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {is403 ? "Access Denied" : error.status}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {is403
              ? "You do not have permission to view this form submission."
              : error.data || "Something went wrong"}
          </p>
          <Button onClick={() => navigate("/workflows")}>
            Back to Workflows
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Unexpected Error
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Something went wrong while loading this form.
        </p>
        <Button onClick={() => navigate("/workflows")}>
          Back to Workflows
        </Button>
      </div>
    </div>
  );
}
