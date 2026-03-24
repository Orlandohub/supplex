import { useState, useMemo, useCallback, useRef } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import type {
  FormTemplateVersionWithStructure,
  FormAnswer,
  FieldType,
} from "@supplex/types";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { TextField } from "./fields/TextField";
import { TextareaField } from "./fields/TextareaField";
import { NumberField } from "./fields/NumberField";
import { DateField } from "./fields/DateField";
import { DropdownField } from "./fields/DropdownField";
import { CheckboxField } from "./fields/CheckboxField";
import { MultiSelectField } from "./fields/MultiSelectField";

export interface FormRendererProps {
  formVersion: FormTemplateVersionWithStructure;
  initialAnswers: FormAnswer[];
  mode: "edit" | "view";
  onSave?: (answers: Map<string, string>) => Promise<void>;
  onSubmit?: (answers: Map<string, string>) => Promise<void>;
}

interface FormData {
  [fieldId: string]: string;
}

export function FormRenderer({
  formVersion,
  initialAnswers,
  mode,
  onSave,
  onSubmit,
}: FormRendererProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultValues = useMemo(() => {
    const values: FormData = {};
    initialAnswers.forEach((answer) => {
      values[answer.formFieldId] = answer.answerValue || "";
    });
    return values;
  }, [initialAnswers]);

  const requiredFieldIds = useMemo(() => {
    return formVersion.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.required)
      .map((field) => field.id);
  }, [formVersion.sections]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<FormData>({
    defaultValues,
    mode: "onBlur",
  });

  const watchedRequiredValues = useWatch({
    control,
    name: requiredFieldIds,
  });

  const canSubmit = useMemo(() => {
    if (mode !== "edit") return false;
    return watchedRequiredValues.every(
      (value) => value != null && String(value).trim() !== ""
    );
  }, [mode, watchedRequiredValues]);

  const handleSaveDraft = useCallback(async () => {
    if (!onSave) return;

    setIsSaving(true);
    setSubmitError(null);
    setSaveSuccess(false);
    if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current);

    try {
      await trigger();

      const currentValues = getValues();
      const answers = new Map<string, string>();
      Object.entries(currentValues).forEach(([fieldId, value]) => {
        if (value && value.trim() !== "") {
          answers.set(fieldId, value);
        }
      });

      await onSave(answers);
      setSaveSuccess(true);
      saveSuccessTimer.current = setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      setSubmitError(error.message || "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  }, [onSave, trigger, getValues]);

  const onSubmitForm = handleSubmit(async (data) => {
    if (!onSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const answers = new Map<string, string>();
      Object.entries(data).forEach(([fieldId, value]) => {
        if (value && value.trim() !== "") {
          answers.set(fieldId, value);
        }
      });

      await onSubmit(answers);
    } catch (error: any) {
      setSubmitError(error.message || "Failed to submit form");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="w-full md:max-w-2xl lg:max-w-3xl mx-auto space-y-6">
      {/* Form Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">
          {formVersion.sections[0]?.title || "Form"}
        </h1>
        {mode === "view" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This form has been submitted and is now read-only.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Error Message */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <Alert className="bg-green-50 text-green-900 border-green-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Draft saved successfully!</AlertDescription>
        </Alert>
      )}

      {/* Form Sections */}
      <form onSubmit={onSubmitForm} className="space-y-6">
        {formVersion.sections
          .sort((a, b) => a.sectionOrder - b.sectionOrder)
          .map((section) => (
            <Card key={section.id} className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{section.title}</h2>
                {section.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {section.description}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {section.fields
                  .sort((a, b) => a.fieldOrder - b.fieldOrder)
                  .map((field) => (
                    <Controller
                      key={field.id}
                      name={field.id}
                      control={control}
                      rules={{
                        required: field.required
                          ? `${field.label} is required`
                          : false,
                        validate: (value) => {
                          if (!field.required && (!value || value.trim() === "")) {
                            return true;
                          }
                          return validateFieldValue(value, field as any);
                        },
                      }}
                      render={({ field: controllerField }) => {
                        const fieldError = errors[field.id]?.message as
                          | string
                          | undefined;

                        return renderField(
                          field as any,
                          controllerField.value || "",
                          controllerField.onChange,
                          fieldError || null,
                          mode === "view"
                        );
                      }}
                    />
                  ))}
              </div>
            </Card>
          ))}

        {/* Action Buttons */}
        {mode === "edit" && (
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Draft"
              )}
            </Button>

            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting || isSaving}
              className="w-full sm:w-auto"
              title={
                !canSubmit
                  ? "Please complete all required fields"
                  : "Submit form"
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Form"
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

function renderField(
  field: any,
  value: string,
  onChange: (value: string) => void,
  error: string | null,
  disabled: boolean
) {
  const commonProps = {
    field,
    value,
    onChange,
    error,
    disabled,
  };

  switch (field.fieldType) {
    case "text":
      return <TextField {...commonProps} />;
    case "textarea":
      return <TextareaField {...commonProps} />;
    case "number":
      return <NumberField {...commonProps} />;
    case "date":
      return <DateField {...commonProps} />;
    case "dropdown":
      return <DropdownField {...commonProps} />;
    case "checkbox":
      return <CheckboxField {...commonProps} />;
    case "multi_select":
      return <MultiSelectField {...commonProps} />;
    default:
      return (
        <div className="text-red-500">
          Unsupported field type: {field.fieldType}
        </div>
      );
  }
}

function validateFieldValue(value: string, field: any): string | true {
  if (!value || value.trim() === "") {
    return true;
  }

  switch (field.fieldType) {
    case "number": {
      const num = Number(value);
      if (isNaN(num)) {
        return "Must be a valid number";
      }
      const rules = field.validationRules;
      if (rules?.min !== undefined && num < rules.min) {
        return `Must be at least ${rules.min}`;
      }
      if (rules?.max !== undefined && num > rules.max) {
        return `Must be at most ${rules.max}`;
      }
      break;
    }

    case "date": {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value)) {
        return "Must be a valid date (YYYY-MM-DD)";
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return "Must be a valid date";
      }
      break;
    }

    case "text":
    case "textarea": {
      const rules = field.validationRules;
      if (rules?.minLength && value.length < rules.minLength) {
        return `Must be at least ${rules.minLength} characters`;
      }
      if (rules?.maxLength && value.length > rules.maxLength) {
        return `Must be at most ${rules.maxLength} characters`;
      }
      if (rules?.pattern) {
        try {
          const regex = new RegExp(rules.pattern);
          if (!regex.test(value)) {
            return rules.customMessage || "Invalid format";
          }
        } catch (e) {
          console.error("Invalid regex pattern:", rules.pattern);
        }
      }
      break;
    }
  }

  return true;
}
