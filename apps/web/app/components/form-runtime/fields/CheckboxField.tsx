import { memo } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import type { FormFieldWithDetails as FormField } from "@supplex/types";

export interface CheckboxFieldProps {
  field: FormField;
  value: string; // "true" or "false" as string
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}

/**
 * CheckboxField Component
 * Renders a checkbox field
 * Value stored as "true" or "false" string
 */
export const CheckboxField = memo(function CheckboxField({
  field,
  value,
  onChange,
  error,
  disabled,
}: CheckboxFieldProps) {
  const isChecked = value === "true";

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id={field.id}
          checked={isChecked}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          disabled={disabled}
          aria-required={field.required}
          aria-describedby={error ? `${field.id}-error` : undefined}
        />
        <Label
          htmlFor={field.id}
          className="flex items-center gap-1 cursor-pointer"
        >
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </Label>
      </div>
      {error && (
        <p id={`${field.id}-error`} className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});
