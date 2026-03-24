import { memo } from "react";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import type { FormField } from "@supplex/types";

export interface TextareaFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}

/**
 * TextareaField Component
 * Renders a multi-line text input field with character counter
 */
export const TextareaField = memo(function TextareaField({
  field,
  value,
  onChange,
  error,
  disabled,
}: TextareaFieldProps) {
  const maxLength = field.validationRules?.maxLength;
  const currentLength = value.length;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </Label>
      <Textarea
        id={field.id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ""}
        disabled={disabled}
        aria-required={field.required}
        aria-describedby={
          error ? `${field.id}-error` : maxLength ? `${field.id}-counter` : undefined
        }
        className={error ? "border-red-500" : ""}
        rows={4}
      />
      {maxLength && (
        <p
          id={`${field.id}-counter`}
          className={`text-sm ${
            currentLength > maxLength ? "text-red-500" : "text-gray-500"
          }`}
        >
          {currentLength} / {maxLength} characters
        </p>
      )}
      {error && (
        <p id={`${field.id}-error`} className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});

