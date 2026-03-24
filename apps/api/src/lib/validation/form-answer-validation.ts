/**
 * Form Answer Validation Utilities
 * Shared validation logic for form field answers
 * Story: 2.2.4 - Form Runtime Execution with Save Draft
 *
 * Extracted from duplicated code in create-draft.ts and submit.ts
 */

/**
 * Validate answer format based on field type
 * Returns error message if invalid, null if valid
 *
 * @param answerValue - The answer value to validate (stored as string)
 * @param field - The field definition with type and validation rules
 * @returns Error message string if invalid, null if valid
 */
export function validateAnswerFormat(
  answerValue: string,
  field: any
): string | null {
  // Empty values are allowed for draft saves (required validation only on submit)
  if (!answerValue || answerValue.trim() === "") {
    return null;
  }

  switch (field.fieldType) {
    case "number": {
      const num = Number(answerValue);
      if (isNaN(num)) {
        return "Must be a valid number";
      }
      // Check validation_rules min/max
      const rules = field.validationRules as any;
      if (rules?.min !== undefined && num < rules.min) {
        return `Must be at least ${rules.min}`;
      }
      if (rules?.max !== undefined && num > rules.max) {
        return `Must be at most ${rules.max}`;
      }
      break;
    }

    case "date": {
      // Validate ISO date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(answerValue)) {
        return "Must be a valid date in YYYY-MM-DD format";
      }
      const date = new Date(answerValue);
      if (isNaN(date.getTime())) {
        return "Must be a valid date";
      }
      break;
    }

    case "dropdown": {
      // Validate against options.choices
      const options = field.options as any;
      if (!options?.choices || !Array.isArray(options.choices)) {
        return "Field configuration error: missing choices";
      }
      const validValues = options.choices.map((c: any) => c.value);
      if (!validValues.includes(answerValue)) {
        return `Must be one of: ${validValues.join(", ")}`;
      }
      break;
    }

    case "multi_select": {
      // Validate comma-separated values against options.choices
      const options = field.options as any;
      if (!options?.choices || !Array.isArray(options.choices)) {
        return "Field configuration error: missing choices";
      }
      const validValues = options.choices.map((c: any) => c.value);
      const selectedValues = answerValue.split(",").map((v) => v.trim());
      for (const val of selectedValues) {
        if (!validValues.includes(val)) {
          return `Invalid selection: ${val}. Must be one of: ${validValues.join(", ")}`;
        }
      }
      break;
    }

    case "checkbox": {
      // Must be "true" or "false"
      if (answerValue !== "true" && answerValue !== "false") {
        return 'Must be "true" or "false"';
      }
      break;
    }

    case "text":
    case "textarea": {
      // Check validation_rules minLength/maxLength/pattern
      const rules = field.validationRules as any;
      if (rules?.minLength && answerValue.length < rules.minLength) {
        return `Must be at least ${rules.minLength} characters`;
      }
      if (rules?.maxLength && answerValue.length > rules.maxLength) {
        return `Must be at most ${rules.maxLength} characters`;
      }
      if (rules?.pattern) {
        try {
          const regex = new RegExp(rules.pattern);
          if (!regex.test(answerValue)) {
            return rules.customMessage || "Invalid format";
          }
        } catch (e) {
          console.error("Invalid regex pattern:", rules.pattern);
        }
      }
      break;
    }
  }

  return null;
}

