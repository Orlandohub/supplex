/**
 * Document Template Dialog Component
 * Create/Edit dialog for document templates
 * Story 2.2.11
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { RequiredDocumentsList } from "./RequiredDocumentsList";
import type { DocumentTemplate, RequiredDocumentItem } from "@supplex/types";

interface DocumentTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  mode: "create" | "edit";
  initialData?: DocumentTemplate;
}

export function DocumentTemplateDialog({
  open,
  onOpenChange,
  onSubmit,
  mode,
  initialData,
}: DocumentTemplateDialogProps) {
  const [templateName, setTemplateName] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    "published"
  );
  const [isDefault, setIsDefault] = useState(false);
  const [requiredDocuments, setRequiredDocuments] = useState<
    RequiredDocumentItem[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setTemplateName(initialData.templateName);
        setStatus(initialData.status as "draft" | "published" | "archived");
        setIsDefault(initialData.isDefault);
        setRequiredDocuments(
          Array.isArray(initialData.requiredDocuments)
            ? initialData.requiredDocuments
            : []
        );
      } else {
        setTemplateName("");
        setStatus("published");
        setIsDefault(false);
        setRequiredDocuments([]);
      }
      setValidationError(null);
    }
  }, [open, mode, initialData]);

  const validateForm = (): string | null => {
    if (!templateName.trim()) {
      return "Template name is required";
    }

    if (templateName.length > 200) {
      return "Template name must be 200 characters or less";
    }

    // Validate required documents
    for (let i = 0; i < requiredDocuments.length; i++) {
      const doc = requiredDocuments[i];
      if (!doc) continue;
      if (!doc.name.trim()) {
        return `Document ${i + 1}: Name is required`;
      }
      if (!doc.description.trim()) {
        return `Document ${i + 1}: Description is required`;
      }
      if (!doc.type) {
        return `Document ${i + 1}: Type is required`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      await onSubmit({
        templateName: templateName.trim(),
        requiredDocuments,
        isDefault,
        status,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showPublishedWarning =
    mode === "edit" && initialData?.status === "published";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Create Document Template"
              : "Edit Document Template"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Define a reusable document checklist template for workflow steps."
              : "Update the document template. Changes will affect future workflow instances."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {showPublishedWarning && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This template is published. Changes may affect existing
                workflows using this template.
              </AlertDescription>
            </Alert>
          )}

          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="templateName">Template Name *</Label>
            <Input
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., ISO Certification Documents"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {templateName.length}/200 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label>Status *</Label>
            <RadioGroup
              value={status}
              onValueChange={(value: any) => setStatus(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="draft" id="status-draft" />
                <Label
                  htmlFor="status-draft"
                  className="cursor-pointer font-normal"
                >
                  Draft - Template is being created/edited
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="published" id="status-published" />
                <Label
                  htmlFor="status-published"
                  className="cursor-pointer font-normal"
                >
                  Published - Template is available for use in workflows
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="archived" id="status-archived" />
                <Label
                  htmlFor="status-archived"
                  className="cursor-pointer font-normal"
                >
                  Archived - Template is deprecated but preserved
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <Label htmlFor="isDefault" className="cursor-pointer font-normal">
              Set as default template for tenant
            </Label>
          </div>

          <RequiredDocumentsList
            documents={requiredDocuments}
            onChange={setRequiredDocuments}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                  ? "Create Template"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
