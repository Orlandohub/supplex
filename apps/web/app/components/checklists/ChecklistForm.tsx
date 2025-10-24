import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { DocumentChecklist, RequiredDocumentType } from "@supplex/types";

// Type for checklist data with dates as strings (after serialization)
type SerializedDocumentChecklist = Omit<
  DocumentChecklist,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

// Document type enum values
const DOCUMENT_TYPES = [
  "CERTIFICATION",
  "TAX",
  "INSURANCE",
  "FINANCIAL",
  "QUALITY",
  "LEGAL",
  "REFERENCE",
  "OTHER",
] as const;

const documentTypeLabels: Record<RequiredDocumentType, string> = {
  CERTIFICATION: "Certification",
  TAX: "Tax",
  INSURANCE: "Insurance",
  FINANCIAL: "Financial",
  QUALITY: "Quality",
  LEGAL: "Legal",
  REFERENCE: "Reference",
  OTHER: "Other",
};

// Default documents for new checklists
const DEFAULT_DOCUMENTS = [
  {
    name: "ISO 9001 Certificate",
    description: "Current ISO 9001 quality management certification",
    required: true,
    type: "CERTIFICATION",
  },
  {
    name: "Business License",
    description: "Valid business registration or operating license",
    required: true,
    type: "LEGAL",
  },
  {
    name: "Insurance Certificate",
    description: "Proof of general liability insurance",
    required: true,
    type: "INSURANCE",
  },
  {
    name: "W-9 Tax Form",
    description: "Completed W-9 for tax reporting purposes",
    required: true,
    type: "TAX",
  },
  {
    name: "Quality Manual",
    description: "Company quality management system documentation",
    required: true,
    type: "QUALITY",
  },
];

// Form validation schema
const checklistFormSchema = z.object({
  templateName: z
    .string()
    .min(1, "Template name is required")
    .max(200, "Template name must be less than 200 characters"),
  requiredDocuments: z
    .array(
      z.object({
        name: z.string().min(1, "Document name is required"),
        description: z.string(),
        required: z.boolean(),
        type: z.string(),
      })
    )
    .min(1, "At least one document is required"),
  isDefault: z.boolean().optional(),
});

type ChecklistFormData = z.infer<typeof checklistFormSchema>;

interface ChecklistFormProps {
  mode: "create" | "edit";
  checklist?: SerializedDocumentChecklist;
  isSubmitting: boolean;
  onSubmit: (data: ChecklistFormData) => void;
  onCancel: () => void;
}

export function ChecklistForm({
  mode,
  checklist,
  isSubmitting,
  onSubmit,
  onCancel,
}: ChecklistFormProps) {
  // Initialize React Hook Form
  const form = useForm<ChecklistFormData>({
    resolver: zodResolver(checklistFormSchema),
    mode: "onBlur",
    defaultValues: checklist
      ? {
          templateName: checklist.templateName,
          requiredDocuments: checklist.requiredDocuments,
          isDefault: checklist.isDefault,
        }
      : {
          templateName: "",
          requiredDocuments: DEFAULT_DOCUMENTS,
          isDefault: false,
        },
  });

  const { formState, control, register, handleSubmit } = form;
  const { errors } = formState;

  // Field array for dynamic required documents
  const { fields, append, remove } = useFieldArray({
    control,
    name: "requiredDocuments",
  });

  const handleAddDocument = () => {
    append({
      name: "",
      description: "",
      required: true,
      type: "OTHER",
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Template Name */}
      <div>
        <Label htmlFor="templateName">
          Template Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="templateName"
          {...register("templateName")}
          className={errors.templateName ? "border-red-500" : ""}
          placeholder="e.g., ISO 9001 Standard Qualification"
        />
        {errors.templateName && (
          <p className="mt-1 text-sm text-red-600">
            {errors.templateName.message}
          </p>
        )}
      </div>

      {/* Is Default Checkbox */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isDefault"
          {...register("isDefault")}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <Label htmlFor="isDefault" className="font-normal cursor-pointer">
          Set as default template (used for new qualifications)
        </Label>
      </div>

      {/* Required Documents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Label className="text-base font-semibold">
            Required Documents <span className="text-red-500">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddDocument}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Document
          </Button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="p-4 border border-gray-200 rounded-lg space-y-3"
            >
              <div className="flex items-start justify-between">
                <h4 className="text-sm font-medium text-gray-900">
                  Document {index + 1}
                </h4>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-600 hover:text-red-900"
                    aria-label={`Remove document ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Document Name */}
              <div>
                <Label htmlFor={`requiredDocuments.${index}.name`}>
                  Document Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`requiredDocuments.${index}.name`}
                  {...register(`requiredDocuments.${index}.name`)}
                  className={
                    errors.requiredDocuments?.[index]?.name
                      ? "border-red-500"
                      : ""
                  }
                  placeholder="e.g., ISO 9001 Certificate"
                />
                {errors.requiredDocuments?.[index]?.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.requiredDocuments[index]?.name?.message}
                  </p>
                )}
              </div>

              {/* Document Description */}
              <div>
                <Label htmlFor={`requiredDocuments.${index}.description`}>
                  Description
                </Label>
                <Textarea
                  id={`requiredDocuments.${index}.description`}
                  {...register(`requiredDocuments.${index}.description`)}
                  rows={2}
                  placeholder="Brief description of the document"
                />
              </div>

              {/* Document Type */}
              <div>
                <Label htmlFor={`requiredDocuments.${index}.type`}>
                  Document Type
                </Label>
                <Controller
                  control={control}
                  name={`requiredDocuments.${index}.type`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {documentTypeLabels[type as RequiredDocumentType]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Is Required Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`requiredDocuments.${index}.required`}
                  {...register(`requiredDocuments.${index}.required`)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label
                  htmlFor={`requiredDocuments.${index}.required`}
                  className="font-normal cursor-pointer"
                >
                  This document is required
                </Label>
              </div>
            </div>
          ))}
        </div>

        {errors.requiredDocuments?.root && (
          <p className="mt-2 text-sm text-red-600">
            {errors.requiredDocuments.root.message}
          </p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : mode === "create"
              ? "Create Template"
              : "Update Template"}
        </Button>
      </div>
    </form>
  );
}
