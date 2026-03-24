import { memo } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import type { FormField, FieldOptions } from "@supplex/types";

export interface MultiSelectFieldProps {
  field: FormField;
  value: string; // Comma-separated values: "value1,value2,value3"
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}

/**
 * MultiSelectField Component
 * Renders multiple checkboxes for multi-selection
 * Value stored as comma-separated string: "value1,value2,value3"
 */
export const MultiSelectField = memo(function MultiSelectField({
  field,
  value,
  onChange,
  error,
  disabled,
}: MultiSelectFieldProps) {
  const options = field.options as FieldOptions;
  const choices = options?.choices || [];

  // Parse current selections from comma-separated string
  const selectedValues = value ? value.split(",").map((v) => v.trim()) : [];

  const handleCheckboxChange = (choiceValue: string, checked: boolean) => {
    let newSelections: string[];

    if (checked) {
      // Add to selections
      newSelections = [...selectedValues, choiceValue];
    } else {
      // Remove from selections
      newSelections = selectedValues.filter((v) => v !== choiceValue);
    }

    // Convert back to comma-separated string
    onChange(newSelections.join(","));
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </Label>
      <div
        className="space-y-2"
        aria-required={field.required}
        aria-describedby={error ? `${field.id}-error` : undefined}
      >
        {choices.map((choice) => {
          const isChecked = selectedValues.includes(choice.value);
          const checkboxId = `${field.id}-${choice.value}`;

          return (
            <div key={choice.value} className="flex items-center space-x-2">
              <Checkbox
                id={checkboxId}
                checked={isChecked}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(choice.value, checked as boolean)
                }
                disabled={disabled}
              />
              <Label htmlFor={checkboxId} className="cursor-pointer">
                {choice.label}
              </Label>
            </div>
          );
        })}
      </div>
      {error && (
        <p id={`${field.id}-error`} className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});

