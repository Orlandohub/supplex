/**
 * useFormSubmission Hook
 * Manages form submission state and API calls for draft saving and form submission
 * Story: 2.2.4 - Form Runtime Execution with Save Draft
 */

import { useState } from "react";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { errorBody, getErrorMessage } from "~/lib/api-helpers";
import { useToast } from "~/hooks/use-toast";

interface UseFormSubmissionOptions {
  token: string;
  onSaveSuccess?: () => void;
  onSubmitSuccess?: (processInstanceId?: string | null) => void;
}

export function useFormSubmission({
  token,
  onSaveSuccess,
  onSubmitSuccess,
}: UseFormSubmissionOptions) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Save draft submission
   * Allows saving without required fields (AC: 2)
   * @param silent - When true, skips toast and onSaveSuccess callback (used before submit)
   */
  const saveDraft = async (
    formTemplateId: string,
    answers: Map<string, string>,
    processInstanceId?: string | null,
    stepInstanceId?: string | null,
    silent?: boolean
  ): Promise<{ success: boolean; submissionId?: string; error?: string }> => {
    setIsSaving(true);

    try {
      const client = createClientEdenTreatyClient(token);

      const answersArray = Array.from(answers.entries())
        .filter(([_, value]) => value && value.trim() !== "")
        .map(([formFieldId, answerValue]) => ({
          formFieldId,
          answerValue,
        }));

      const response = await client.api["form-submissions"].draft.post({
        formTemplateId,
        processInstanceId: processInstanceId || null,
        stepInstanceId: stepInstanceId || null,
        answers: answersArray,
      });

      if (response.error) {
        const errBody = errorBody(response.error);
        const errorMessage = errBody?.error.message || "Failed to save draft";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        return { success: false, error: errorMessage };
      }

      const draftPayload = response.data as {
        success: boolean;
        data?: { submission?: { id?: string } };
      } | null;
      const submissionId = draftPayload?.data?.submission?.id;

      if (!silent) {
        toast({
          title: "Draft Saved",
          description: "Your progress has been saved successfully.",
        });

        if (onSaveSuccess) {
          onSaveSuccess();
        }
      }

      return { success: true, submissionId };
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to save draft");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Submit form
   * Validates required fields and makes form immutable (AC: 4, 5)
   */
  const submitForm = async (
    submissionId: string
  ): Promise<{
    success: boolean;
    processInstanceId?: string | null;
    error?: string;
  }> => {
    setIsSubmitting(true);

    try {
      const client = createClientEdenTreatyClient(token);

      const response = await client.api["form-submissions"]({
        submissionId,
      }).submit.post();

      if (response.error) {
        const errBody = errorBody(response.error);
        const errorMessage = errBody?.error.message || "Failed to submit form";

        if (errBody?.error.code === "REQUIRED_FIELD_MISSING") {
          const missingFieldsRaw = errBody.error.details?.missingFields;
          const missingFields = Array.isArray(missingFieldsRaw)
            ? missingFieldsRaw.join(", ")
            : undefined;
          toast({
            title: "Required Fields Missing",
            description: missingFields
              ? `Please fill in: ${missingFields}`
              : errorMessage,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }

        return { success: false, error: errorMessage };
      }

      const submitPayload = response.data as {
        success: boolean;
        data?: { processInstanceId?: string | null };
      } | null;
      const processInstanceId = submitPayload?.data?.processInstanceId || null;

      toast({
        title: "Form Submitted",
        description: "Your form has been submitted successfully.",
      });

      if (onSubmitSuccess) {
        onSubmitSuccess(processInstanceId);
      }

      return { success: true, processInstanceId };
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Failed to submit form");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return { success: false, error: errorMessage };
    }
  };

  return {
    saveDraft,
    submitForm,
    isSaving,
    isSubmitting,
  };
}
