/**
 * Edit Field Modal Component
 * Modal form for editing an existing field
 */

import { useState, useEffect } from "react";
import { useRevalidator } from "react-router";
import type { FormFieldWithDetails } from "@supplex/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { FieldOptionsEditor, type FieldOption } from "./FieldOptionsEditor";

interface EditFieldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: FormFieldWithDetails;
  token: string;
}

export function EditFieldModal({
  open,
  onOpenChange,
  field,
  token,
}: EditFieldModalProps) {
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const [label, setLabel] = useState(field.label);
  const [fieldType, setFieldType] = useState(field.fieldType);
  const [required, setRequired] = useState(field.required);
  const [placeholder, setPlaceholder] = useState(field.placeholder || "");
  const [options, setOptions] = useState<FieldOption[]>(
    (field.options as any)?.choices || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when field changes
  useEffect(() => {
    setLabel(field.label);
    setFieldType(field.fieldType);
    setRequired(field.required);
    setPlaceholder(field.placeholder || "");
    setOptions((field.options as any)?.choices || []);
  }, [field]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!label.trim()) {
      return;
    }

    // Validate options for dropdown and multi_select fields
    if (fieldType === "dropdown" || fieldType === "multi_select") {
      if (options.length === 0) {
        toast({
          title: "Validation Error",
          description:
            "Dropdown and multi-select fields must have at least one option",
          variant: "destructive",
        });
        return;
      }

      // Validate each option has non-empty value and label
      const hasInvalidOption = options.some(
        (opt) => !opt.value.trim() || !opt.label.trim()
      );
      if (hasInvalidOption) {
        toast({
          title: "Validation Error",
          description: "All options must have both value and label",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const client = createClientEdenTreatyClient(token);

      // Prepare options payload — only `dropdown`/`multi_select` carry choices.
      const optionsPayload =
        fieldType === "dropdown" || fieldType === "multi_select"
          ? { choices: options }
          : undefined;

      const response = await client.api["form-templates"]
        .fields({
          fieldId: field.id,
        })
        .patch({
          label: label.trim(),
          fieldType: fieldType as any,
          required,
          placeholder: placeholder.trim() || undefined,
          options: optionsPayload,
        });

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to update field",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Field updated successfully",
      });

      onOpenChange(false);
      revalidator.revalidate();
    } catch (error) {
      console.error("Error updating field:", error);
      toast({
        title: "Error",
        description: "Failed to update field",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>Update field configuration</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Field Label *</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={255}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fieldType">Field Type *</Label>
              <Select
                value={fieldType}
                onValueChange={setFieldType as any}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text (single line)</SelectItem>
                  <SelectItem value="textarea">
                    Text Area (multi line)
                  </SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="multi_select">Multi Select</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="placeholder">Placeholder (Optional)</Label>
              <Input
                id="placeholder"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="required"
                checked={required}
                onCheckedChange={(checked) => setRequired(checked as boolean)}
                disabled={isSubmitting}
              />
              <Label htmlFor="required" className="cursor-pointer">
                Mark as required field
              </Label>
            </div>

            {/* Options Editor for dropdown and multi_select fields */}
            {(fieldType === "dropdown" || fieldType === "multi_select") && (
              <FieldOptionsEditor
                options={options}
                onChange={setOptions}
                fieldType={fieldType}
                disabled={isSubmitting}
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !label.trim() ||
                ((fieldType === "dropdown" || fieldType === "multi_select") &&
                  options.length === 0)
              }
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
