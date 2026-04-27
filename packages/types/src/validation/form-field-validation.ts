/**
 * Shared Form Field Validation
 * Story: 2.2.23 — Consolidate client/server validation into a single module
 *
 * Single source of truth for field-level validation. Used by:
 * - Server: apps/api/src/lib/validation/form-answer-validation.ts
 * - Client: apps/web/app/components/form-runtime/FormRenderer.tsx
 */

import type {
  FieldType,
  ValidationRules,
  FieldOptions,
} from "../models/form-template";

export interface FieldDefinition {
  fieldType: FieldType | string;
  required?: boolean;
  validationRules?: ValidationRules | null;
  options?: FieldOptions | Record<string, never> | null;
}

/**
 * Validate a single field value against its definition.
 * Returns an error message string if invalid, null if valid.
 * Empty values are always considered valid here — required-field
 * checks are handled separately at submit time.
 */
export function validateFieldValue(
  value: string,
  field: FieldDefinition
): string | null {
  if (!value || value.trim() === "") {
    return null;
  }

  switch (field.fieldType) {
    case "number": {
      const num = Number(value);
      if (isNaN(num)) {
        return "Must be a valid number";
      }
      const rules = field.validationRules;
      if (rules?.min !== undefined && num < rules.min) {
        return `Must be at least ${rules.min}`;
      }
      if (rules?.max !== undefined && num > rules.max) {
        return `Must be at most ${rules.max}`;
      }
      break;
    }

    case "date": {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value)) {
        return "Must be a valid date in YYYY-MM-DD format";
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return "Must be a valid date";
      }
      break;
    }

    case "dropdown": {
      const opts = field.options as FieldOptions | null;
      if (!opts?.choices || !Array.isArray(opts.choices)) {
        return "Field configuration error: missing choices";
      }
      const validValues = opts.choices.map((c) => c.value);
      if (!validValues.includes(value)) {
        return `Must be one of: ${validValues.join(", ")}`;
      }
      break;
    }

    case "multi_select": {
      const opts = field.options as FieldOptions | null;
      if (!opts?.choices || !Array.isArray(opts.choices)) {
        return "Field configuration error: missing choices";
      }
      const validValues = opts.choices.map((c) => c.value);
      const selectedValues = value.split(",").map((v) => v.trim());
      for (const val of selectedValues) {
        if (!validValues.includes(val)) {
          return `Invalid selection: ${val}. Must be one of: ${validValues.join(", ")}`;
        }
      }
      break;
    }

    case "checkbox": {
      if (value !== "true" && value !== "false") {
        return 'Must be "true" or "false"';
      }
      break;
    }

    case "text":
    case "textarea": {
      const rules = field.validationRules;
      if (rules?.minLength && value.length < rules.minLength) {
        return `Must be at least ${rules.minLength} characters`;
      }
      if (rules?.maxLength && value.length > rules.maxLength) {
        return `Must be at most ${rules.maxLength} characters`;
      }
      if (rules?.pattern) {
        try {
          const regex = new RegExp(rules.pattern);
          if (!regex.test(value)) {
            return rules.customMessage || "Invalid format";
          }
        } catch {
          // Invalid regex in configuration — skip pattern check
        }
      }
      break;
    }
  }

  return null;
}
