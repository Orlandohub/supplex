import { memo } from "react";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { FormField, FieldOptions } from "@supplex/types";

export interface DropdownFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}

/**
 * DropdownField Component
 * Renders a dropdown select field
 */
export const DropdownField = memo(function DropdownField({
  field,
  value,
  onChange,
  error,
  disabled,
}: DropdownFieldProps) {
  const options = field.options as FieldOptions;
  const choices = options?.choices || [];

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={field.id}
          aria-required={field.required}
          aria-describedby={error ? `${field.id}-error` : undefined}
          className={error ? "border-red-500" : ""}
        >
          <SelectValue placeholder={field.placeholder || "Select an option"} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={`${field.id}-error`} className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});

