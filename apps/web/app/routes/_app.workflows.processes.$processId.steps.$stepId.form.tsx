/**
 * Workflow Step Form Handler
 * Creates or retrieves form submission for a workflow step and redirects to form
 * Updated: Story 2.2.14 - Uses formTemplateId instead of versionId
 * Updated: Story 2.2.16 - Loading state and error handling
 */

import { redirect, type LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { Loader2 } from "lucide-react";

export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;

  // Require authentication
  const { session, user: _user } = await requireAuth(args);

  const { processId, stepId } = params;
  if (!processId || !stepId) {
    throw new Response("Process ID and Step ID are required", { status: 400 });
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  try {
    // Get the step instance to find the form template ID
    const stepResponse = await client.api.workflows
      .steps({ stepInstanceId: stepId })
      .get();

    if (stepResponse.error) {
      const status = stepResponse.status || 500;
      if (status === 404) {
        throw new Response("Step not found", { status: 404 });
      }
      throw new Response("Failed to load step", { status });
    }

    const stepData = stepResponse.data?.data as any;
    const step = stepData.step;
    const stepTemplate = stepData.stepTemplate;

    // Verify this is a form step
    if (step.stepType !== "form") {
      throw new Response("This step is not a form step", { status: 400 });
    }

    // Get form template ID from step template
    const formTemplateId = stepTemplate?.formTemplateId;
    if (!formTemplateId) {
      throw new Response("Form template ID not found for this step", {
        status: 400,
      });
    }

    // Check if a form submission already exists for this step
    const submissionsResponse = await client.api["form-submissions"].get({
      query: {
        stepInstanceId: stepId,
      },
    });

    if (submissionsResponse.error) {
      throw new Response("Failed to check existing submissions", {
        status: 500,
      });
    }

    const submissionsData = submissionsResponse.data?.data as any;
    const existingSubmissions = submissionsData?.submissions || [];

    console.log("[FORM STEP] Checking for existing submissions:", {
      stepId,
      found: existingSubmissions.length,
      submissions: existingSubmissions.map((s: any) => ({
        id: s.id,
        status: s.status,
        stepInstanceId: s.stepInstanceId,
      })),
    });

    // If submission exists, redirect to it
    if (existingSubmissions.length > 0) {
      const submissionId = existingSubmissions[0].id;
      console.log(
        "[FORM STEP] Found existing submission, redirecting to:",
        submissionId
      );
      return redirect(`/forms/${submissionId}`);
    }

    // Create new form submission for this step
    console.log("[FORM STEP] Creating new submission:", {
      formTemplateId,
      processInstanceId: processId,
      stepInstanceId: stepId,
    });

    const createResponse = await client.api["form-submissions"].draft.post({
      formTemplateId,
      processInstanceId: processId,
      stepInstanceId: stepId,
      answers: [], // Start with empty answers
    });

    if (createResponse.error) {
      console.error("Failed to create form submission:", createResponse.error);
      throw new Response("Failed to create form submission", { status: 500 });
    }

    const createData = createResponse.data?.data as any;
    const newSubmissionId = createData?.submission?.id;

    console.log("[FORM STEP] Created submission:", {
      submissionId: newSubmissionId,
      stepInstanceId: createData?.submission?.stepInstanceId,
    });

    if (!newSubmissionId) {
      throw new Response("Failed to get submission ID", { status: 500 });
    }

    // Redirect to the form execution page
    return redirect(`/forms/${newSubmissionId}`);
  } catch (error) {
    // Re-throw Response objects (redirects, 403, 404, etc.) directly
    if (error instanceof Response) {
      if (error.status === 403) {
        throw new Response("You do not have access to this step", {
          status: 403,
        });
      }
      if (error.status < 500) {
        throw error;
      }
    }

    console.error("Error in form step handler:", error);
    return redirect(`/workflows/processes/${processId}?error=form_load_failed`);
  }
}

/**
 * Loading component shown during navigation transition
 */
export default function FormStepLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-muted-foreground">Preparing form...</p>
    </div>
  );
}
