import { memo } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { FormField } from "@supplex/types";

export interface NumberFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}

/**
 * NumberField Component
 * Renders a number input field with min/max validation
 */
export const NumberField = memo(function NumberField({
  field,
  value,
  onChange,
  error,
  disabled,
}: NumberFieldProps) {
  const min = field.validationRules?.min;
  const max = field.validationRules?.max;

  const hint =
    min !== undefined && max !== undefined
      ? `Value must be between ${min} and ${max}`
      : min !== undefined
        ? `Value must be at least ${min}`
        : max !== undefined
          ? `Value must be at most ${max}`
          : null;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={field.id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ""}
        disabled={disabled}
        min={min}
        max={max}
        aria-required={field.required}
        aria-describedby={
          error
            ? `${field.id}-error`
            : hint
              ? `${field.id}-hint`
              : undefined
        }
        className={error ? "border-red-500" : ""}
      />
      {hint && !error && (
        <p id={`${field.id}-hint`} className="text-sm text-gray-500">
          {hint}
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

