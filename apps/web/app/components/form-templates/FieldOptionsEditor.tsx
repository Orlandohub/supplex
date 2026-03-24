/**
 * Field Options Editor Component
 * Reusable component for managing dropdown/multi-select field options
 */

import { Trash2Icon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export interface FieldOption {
  value: string;
  label: string;
}

interface FieldOptionsEditorProps {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
  fieldType?: string;
  disabled?: boolean;
}

export function FieldOptionsEditor({
  options,
  onChange,
  disabled = false,
}: FieldOptionsEditorProps) {
  const handleAddOption = () => {
    onChange([...options, { value: "", label: "" }]);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    onChange(newOptions);
  };

  const handleUpdateOption = (
    index: number,
    field: "value" | "label",
    newValue: string
  ) => {
    const newOptions = options.map((option, i) => {
      if (i === index) {
        return { ...option, [field]: newValue };
      }
      return option;
    });
    onChange(newOptions);
  };

  // Check if any option is incomplete
  const hasIncompleteOption = options.some(
    (option) => !option.value.trim() || !option.label.trim()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Options *</Label>
        {options.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No options added. Click &apos;Add Option&apos; to get started.
          </p>
        )}
      </div>

      {options.length > 0 && (
        <div className="space-y-3">
          {options.map((option, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
            >
              <div className="space-y-1">
                <Label htmlFor={`option-value-${index}`} className="text-xs">
                  Value
                </Label>
                <Input
                  id={`option-value-${index}`}
                  value={option.value}
                  onChange={(e) =>
                    handleUpdateOption(index, "value", e.target.value)
                  }
                  placeholder="e.g., iso9001"
                  maxLength={255}
                  disabled={disabled}
                  className={
                    !option.value.trim() && options.length > 1
                      ? "border-destructive"
                      : ""
                  }
                />
                {!option.value.trim() && options.length > 1 && (
                  <p className="text-xs text-destructive">Value required</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor={`option-label-${index}`} className="text-xs">
                  Label
                </Label>
                <Input
                  id={`option-label-${index}`}
                  value={option.label}
                  onChange={(e) =>
                    handleUpdateOption(index, "label", e.target.value)
                  }
                  placeholder="e.g., ISO 9001"
                  maxLength={255}
                  disabled={disabled}
                  className={
                    !option.label.trim() && options.length > 1
                      ? "border-destructive"
                      : ""
                  }
                />
                {!option.label.trim() && options.length > 1 && (
                  <p className="text-xs text-destructive">Label required</p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveOption(index)}
                disabled={disabled}
                className="mb-0.5"
                title="Remove option"
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={handleAddOption}
        disabled={disabled || hasIncompleteOption}
        className="w-full"
      >
        + Add Option
      </Button>

      {hasIncompleteOption && (
        <p className="text-sm text-muted-foreground">
          Complete all existing options before adding a new one.
        </p>
      )}

      {options.length === 0 && (
        <p className="text-sm text-destructive">
          Add at least one option
        </p>
      )}
    </div>
  );
}

