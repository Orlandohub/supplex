/**
 * Create New Form Submission Page
 * Start a new form submission
 * Story: 2.2.4 - Form Runtime Execution with Save Draft
 * Updated: Story 2.2.14 - Changed to use formTemplateId
 */

import { data as json, redirect, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { FormTemplateWithStructureUI } from "@supplex/types";
import { ArrowLeft } from "lucide-react";
import { FormRenderer } from "~/components/form-runtime/FormRenderer";
import { useFormSubmission } from "~/hooks/useFormSubmission";

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;

  // Require authentication
  const { userRecord: _userRecord, session } = await requireAuth(args);

  // Get form template ID from query params
  const url = new URL(request.url);
  const formTemplateId = url.searchParams.get("formTemplateId");

  if (!formTemplateId) {
    throw new Response("formTemplateId query parameter is required", {
      status: 400,
    });
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Create Eden Treaty client
  const client = createEdenTreatyClient(token);

  try {
    // Check if user already has a draft for this form template
    // List submissions filtered by draft status
    const listResponse = await client.api["form-submissions"].get({
      query: {
        status: "draft",
      },
    });

    if (!listResponse.error) {
      const data = listResponse.data?.data as any;
      const submissions = data.submissions || [];

      // Find existing draft for this form template
      const existingDraft = submissions.find(
        (sub: any) => sub.formTemplateId === formTemplateId
      );

      if (existingDraft) {
        // Redirect to edit existing draft
        return redirect(`/forms/${existingDraft.id}`);
      }
    }

    // Fetch form template structure
    // TODO: Add endpoint GET /api/form-templates/:id with sections/fields
    // For MVP, we'll return minimal structure
    const formVersion: FormTemplateWithStructureUI = {
      id: formTemplateId,
      formTemplateId: formTemplateId,
      version: 1,
      status: "published",
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      sections: [],
    };

    return json({
      formVersion,
      formTemplateId,
      token,
    });
  } catch (error) {
    console.error("Error loading form template:", error);
    throw new Response("Failed to load form template", { status: 500 });
  }
}

export default function CreateFormSubmissionPage() {
  const { formVersion, formTemplateId, token } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processInstanceId = searchParams.get("processInstanceId");

  const { saveDraft, submitForm } = useFormSubmission({
    token,
    onSaveSuccess: () => {
      // After first save, navigate to the edit page
      // We'll need the submission ID from the save response
    },
  });

  const handleSave = async (answersMap: Map<string, string>) => {
    const result = await saveDraft(
      formTemplateId,
      answersMap,
      processInstanceId
    );

    if (result.success && result.submissionId) {
      // Navigate to the edit page for the newly created submission
      navigate(`/forms/${result.submissionId}`);
    }
  };

  const handleSubmit = async (answersMap: Map<string, string>) => {
    // First save to create the submission
    const saveResult = await saveDraft(
      formTemplateId,
      answersMap,
      processInstanceId
    );

    if (saveResult.success && saveResult.submissionId) {
      // Then submit the form
      const submitResult = await submitForm(saveResult.submissionId);

      if (submitResult.success) {
        // Navigate to view the submitted form
        navigate(`/forms/${saveResult.submissionId}`);
      }
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/forms")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Forms
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Form</h1>
          <p className="text-muted-foreground mt-1">
            Fill in the form below. Your progress will be saved automatically.
          </p>
        </div>
      </div>

      {/* Form Renderer */}
      {formVersion.sections.length > 0 ? (
        <FormRenderer
          formVersion={formVersion}
          initialAnswers={[]}
          mode="edit"
          onSave={handleSave}
          onSubmit={handleSubmit}
        />
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            This form template has no sections or fields yet.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/forms")}
          >
            Back to Forms
          </Button>
        </div>
      )}
    </div>
  );
}
