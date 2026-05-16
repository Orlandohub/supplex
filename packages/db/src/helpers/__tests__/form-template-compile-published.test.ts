import { describe, test, expect } from "bun:test";
import {
  FORM_TEMPLATE_COMPILE_FAILED,
  buildFormTemplateCompiledJsonFromRelationalSubtree,
  type FormCompileFieldInput,
} from "../form-template-compile-published";

const baseField = (
  overrides: Partial<FormCompileFieldInput> &
    Pick<FormCompileFieldInput, "id" | "formSectionId">
): FormCompileFieldInput => ({
  fieldOrder: 1,
  fieldKey: "f",
  label: "L",
  placeholder: null,
  fieldType: "text",
  required: false,
  validationRules: {},
  options: {},
  ...overrides,
});

describe("form-template-compile-published (SUP-33)", () => {
  test("rejects duplicate fieldKey across sections", () => {
    const sections = [
      {
        id: "s1",
        sectionOrder: 1,
        sectionKey: "first",
        title: "T1",
      },
      {
        id: "s2",
        sectionOrder: 2,
        sectionKey: "second",
        title: "T2",
      },
    ];
    const bySection = new Map<string, FormCompileFieldInput[]>();
    bySection.set("s1", [
      baseField({ id: "f1", formSectionId: "s1", fieldKey: "dup" }),
    ]);
    bySection.set("s2", [
      baseField({
        id: "f2",
        formSectionId: "s2",
        fieldOrder: 1,
        fieldKey: "dup",
      }),
    ]);

    expect(() =>
      buildFormTemplateCompiledJsonFromRelationalSubtree(sections, bySection)
    ).toThrow(FORM_TEMPLATE_COMPILE_FAILED);
  });

  test("rejects subtree with zero fields", () => {
    const sections = [
      { id: "s1", sectionOrder: 1, sectionKey: "only", title: "-" },
    ];
    const bySection = new Map<string, FormCompileFieldInput[]>();
    bySection.set("s1", []);

    expect(() =>
      buildFormTemplateCompiledJsonFromRelationalSubtree(sections, bySection)
    ).toThrow(FORM_TEMPLATE_COMPILE_FAILED);
  });

  test("happy path preserves section/field ordering and fills fieldByKey", () => {
    const sections = [
      {
        id: "s_early",
        sectionOrder: 1,
        sectionKey: "a",
        title: "A",
      },
      {
        id: "s_late",
        sectionOrder: 2,
        sectionKey: "b",
        title: "B",
      },
    ];
    const bySection = new Map<string, FormCompileFieldInput[]>();
    bySection.set("s_early", [
      baseField({
        id: "f_a_2",
        formSectionId: "s_early",
        fieldOrder: 2,
        fieldKey: "z_field",
      }),
      baseField({
        id: "f_a_1",
        formSectionId: "s_early",
        fieldOrder: 1,
        fieldKey: "a_field",
        label: "first",
      }),
    ]);
    bySection.set("s_late", [
      baseField({
        id: "f_b_1",
        formSectionId: "s_late",
        fieldOrder: 1,
        fieldKey: "only_b",
      }),
    ]);

    const compiled = buildFormTemplateCompiledJsonFromRelationalSubtree(
      sections,
      bySection
    );

    expect(compiled.schemaVersion).toBe(1);
    expect(compiled.validationPlan).toEqual({ placeholder: true });
    expect(Object.keys(compiled.fieldByKey).sort()).toEqual([
      "a_field",
      "only_b",
      "z_field",
    ]);

    expect(compiled.fieldByKey.a_field.sectionKey).toBe("a");
    expect(compiled.fieldByKey.a_field.sectionId).toBe("s_early");
    expect(compiled.fieldByKey.a_field.id).toBe("f_a_1");

    expect(compiled.orderedWalk).toHaveLength(2);
    expect(compiled.orderedWalk[0].sectionKey).toBe("a");
    expect(compiled.orderedWalk[0].fields.map((x) => x.fieldKey)).toEqual([
      "a_field",
      "z_field",
    ]);
    expect(compiled.orderedWalk[1].fields.map((x) => x.fieldKey)).toEqual([
      "only_b",
    ]);
  });
});
