import { describe, it, expect } from "vitest";
import { validateFieldValue, type FieldDefinition } from "../../validation/form-field-validation";

function field(overrides: Partial<FieldDefinition> & Pick<FieldDefinition, "fieldType">): FieldDefinition {
  return { required: false, validationRules: null, options: null, ...overrides };
}

describe("validateFieldValue", () => {
  // ------ Empty / null values ------
  it("returns null for empty string (any field type)", () => {
    expect(validateFieldValue("", field({ fieldType: "text" }))).toBeNull();
    expect(validateFieldValue("  ", field({ fieldType: "number" }))).toBeNull();
  });

  // ------ number ------
  describe("number", () => {
    const base = field({ fieldType: "number" });

    it("accepts valid number", () => {
      expect(validateFieldValue("42", base)).toBeNull();
      expect(validateFieldValue("-3.14", base)).toBeNull();
    });

    it("rejects non-numeric string", () => {
      expect(validateFieldValue("abc", base)).toBe("Must be a valid number");
    });

    it("enforces min", () => {
      const f = field({ fieldType: "number", validationRules: { min: 10 } });
      expect(validateFieldValue("5", f)).toBe("Must be at least 10");
      expect(validateFieldValue("10", f)).toBeNull();
    });

    it("enforces max", () => {
      const f = field({ fieldType: "number", validationRules: { max: 100 } });
      expect(validateFieldValue("200", f)).toBe("Must be at most 100");
      expect(validateFieldValue("100", f)).toBeNull();
    });
  });

  // ------ date ------
  describe("date", () => {
    const base = field({ fieldType: "date" });

    it("accepts valid ISO date", () => {
      expect(validateFieldValue("2026-04-04", base)).toBeNull();
    });

    it("rejects bad format", () => {
      expect(validateFieldValue("04/04/2026", base)).toBe("Must be a valid date in YYYY-MM-DD format");
    });

    it("rejects invalid date that matches regex", () => {
      expect(validateFieldValue("2026-13-40", base)).toBe("Must be a valid date");
    });
  });

  // ------ dropdown ------
  describe("dropdown", () => {
    const f = field({
      fieldType: "dropdown",
      options: { choices: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
    });

    it("accepts valid choice", () => {
      expect(validateFieldValue("a", f)).toBeNull();
    });

    it("rejects invalid choice", () => {
      expect(validateFieldValue("c", f)).toBe("Must be one of: a, b");
    });

    it("errors when choices missing", () => {
      expect(validateFieldValue("a", field({ fieldType: "dropdown", options: {} as any }))).toBe(
        "Field configuration error: missing choices"
      );
    });
  });

  // ------ multi_select ------
  describe("multi_select", () => {
    const f = field({
      fieldType: "multi_select",
      options: { choices: [{ label: "X", value: "x" }, { label: "Y", value: "y" }] },
    });

    it("accepts valid selections", () => {
      expect(validateFieldValue("x", f)).toBeNull();
      expect(validateFieldValue("x, y", f)).toBeNull();
    });

    it("rejects invalid selection", () => {
      expect(validateFieldValue("x, z", f)).toBe("Invalid selection: z. Must be one of: x, y");
    });
  });

  // ------ checkbox ------
  describe("checkbox", () => {
    const base = field({ fieldType: "checkbox" });

    it("accepts true/false", () => {
      expect(validateFieldValue("true", base)).toBeNull();
      expect(validateFieldValue("false", base)).toBeNull();
    });

    it("rejects other values", () => {
      expect(validateFieldValue("yes", base)).toBe('Must be "true" or "false"');
    });
  });

  // ------ text / textarea ------
  describe("text and textarea", () => {
    it("enforces minLength", () => {
      const f = field({ fieldType: "text", validationRules: { minLength: 5 } });
      expect(validateFieldValue("ab", f)).toBe("Must be at least 5 characters");
      expect(validateFieldValue("abcde", f)).toBeNull();
    });

    it("enforces maxLength", () => {
      const f = field({ fieldType: "textarea", validationRules: { maxLength: 3 } });
      expect(validateFieldValue("abcd", f)).toBe("Must be at most 3 characters");
      expect(validateFieldValue("abc", f)).toBeNull();
    });

    it("enforces pattern with custom message", () => {
      const f = field({
        fieldType: "text",
        validationRules: { pattern: "^[A-Z]+$", customMessage: "Uppercase only" },
      });
      expect(validateFieldValue("abc", f)).toBe("Uppercase only");
      expect(validateFieldValue("ABC", f)).toBeNull();
    });

    it("uses default message when pattern fails without customMessage", () => {
      const f = field({ fieldType: "text", validationRules: { pattern: "^\\d+$" } });
      expect(validateFieldValue("abc", f)).toBe("Invalid format");
    });

    it("ignores invalid regex gracefully", () => {
      const f = field({ fieldType: "text", validationRules: { pattern: "[invalid" } });
      expect(validateFieldValue("abc", f)).toBeNull();
    });
  });
});
