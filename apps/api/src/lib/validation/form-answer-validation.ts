/**
 * Form Answer Validation Utilities
 * Story: 2.2.4 - Form Runtime Execution with Save Draft
 * Updated: Story 2.2.23 — Delegates to shared validation module
 */

import {
  validateFieldValue,
  type FieldDefinition,
} from "@supplex/types";

/**
 * Validate answer format based on field type.
 * Thin wrapper around the shared validateFieldValue for backward compatibility.
 */
export function validateAnswerFormat(
  answerValue: string,
  field: FieldDefinition
): string | null {
  return validateFieldValue(answerValue, field);
}
