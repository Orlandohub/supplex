import { memo } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { FormFieldWithDetails as FormField } from "@supplex/types";

export interface DateFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}

/**
 * DateField Component
 * Renders a date input field
 * Value format: ISO date string (YYYY-MM-DD)
 */
export const DateField = memo(function DateField({
  field,
  value,
  onChange,
  error,
  disabled,
}: DateFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={field.id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-required={field.required}
        aria-describedby={error ? `${field.id}-error` : undefined}
        className={error ? "border-red-500" : ""}
      />
      {error && (
        <p id={`${field.id}-error`} className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});
