import { describe, test, expect } from "bun:test";
import {
  FORM_TEMPLATE_COMPILE_FAILED,
  buildFormTemplateCompiledJsonFromRelationalSubtree,
  type FormCompileFieldInput,
  type FormCompileSectionInput,
} from "../form-template-compile-published";

const SECTION_TS = new Date("2024-06-01T12:00:00.000Z");
const FIELD_TS = new Date("2024-06-01T12:00:00.000Z");

const baseSection = (
  overrides: Partial<FormCompileSectionInput> &
    Pick<FormCompileSectionInput, "id" | "sectionOrder" | "sectionKey">
): FormCompileSectionInput => ({
  slugManuallyEdited: false,
  title: overrides.sectionKey,
  description: null,
  metadata: {},
  createdAt: SECTION_TS,
  updatedAt: SECTION_TS,
  ...overrides,
});

const baseField = (
  overrides: Partial<FormCompileFieldInput> &
    Pick<FormCompileFieldInput, "id" | "formSectionId">
): FormCompileFieldInput => ({
  fieldOrder: 1,
  fieldKey: "f",
  slugManuallyEdited: false,
  label: "L",
  placeholder: null,
  fieldType: "text",
  required: false,
  validationRules: {},
  options: {},
  createdAt: FIELD_TS,
  updatedAt: FIELD_TS,
  ...overrides,
});

describe("form-template-compile-published (SUP-33 + SUP-38)", () => {
  test("rejects duplicate fieldKey across sections", () => {
    const sections = [
      baseSection({
        id: "s1",
        sectionOrder: 1,
        sectionKey: "first",
        title: "T1",
      }),
      baseSection({
        id: "s2",
        sectionOrder: 2,
        sectionKey: "second",
        title: "T2",
      }),
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
      baseSection({
        id: "s1",
        sectionOrder: 1,
        sectionKey: "only",
        title: "-",
      }),
    ];
    const bySection = new Map<string, FormCompileFieldInput[]>();
    bySection.set("s1", []);

    expect(() =>
      buildFormTemplateCompiledJsonFromRelationalSubtree(sections, bySection)
    ).toThrow(FORM_TEMPLATE_COMPILE_FAILED);
  });

  test("happy path emits schemaVersion 2 with full section/field rehydration payload", () => {
    const sections = [
      baseSection({
        id: "s_early",
        sectionOrder: 1,
        sectionKey: "a",
        title: "A",
        description: "section a desc",
        metadata: { color: "blue" },
        slugManuallyEdited: true,
      }),
      baseSection({
        id: "s_late",
        sectionOrder: 2,
        sectionKey: "b",
        title: "B",
      }),
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
        placeholder: "type here",
        required: true,
        validationRules: { minLength: 3 },
      }),
    ]);
    bySection.set("s_late", [
      baseField({
        id: "f_b_1",
        formSectionId: "s_late",
        fieldOrder: 1,
        fieldKey: "only_b",
        fieldType: "dropdown",
        options: {
          choices: [
            { value: "x", label: "X" },
            { value: "y", label: "Y" },
          ],
        },
      }),
    ]);

    const compiled = buildFormTemplateCompiledJsonFromRelationalSubtree(
      sections,
      bySection
    );

    expect(compiled.schemaVersion).toBe(2);
    if (compiled.schemaVersion !== 2) throw new Error("expected v2 payload");

    expect(compiled.validationPlan).toEqual({ placeholder: true });

    expect(Object.keys(compiled.fieldByKey).sort()).toEqual([
      "a_field",
      "only_b",
      "z_field",
    ]);
    expect(compiled.fieldByKey.a_field.sectionKey).toBe("a");
    expect(compiled.fieldByKey.a_field.sectionId).toBe("s_early");
    expect(compiled.fieldByKey.a_field.id).toBe("f_a_1");
    expect(compiled.fieldByKey.a_field.required).toBe(true);

    expect(compiled.orderedWalk).toHaveLength(2);
    expect(compiled.orderedWalk[0].sectionKey).toBe("a");
    expect(compiled.orderedWalk[0].fields.map((x) => x.fieldKey)).toEqual([
      "a_field",
      "z_field",
    ]);
    expect(compiled.orderedWalk[1].fields.map((x) => x.fieldKey)).toEqual([
      "only_b",
    ]);

    expect(compiled.sections).toHaveLength(2);
    const [secA, secB] = compiled.sections;
    expect(secA?.id).toBe("s_early");
    expect(secA?.sectionKey).toBe("a");
    expect(secA?.slugManuallyEdited).toBe(true);
    expect(secA?.description).toBe("section a desc");
    expect(secA?.metadata).toEqual({ color: "blue" });
    expect(secA?.createdAt).toBe(SECTION_TS.toISOString());
    expect(secA?.updatedAt).toBe(SECTION_TS.toISOString());

    expect(secA?.fields).toHaveLength(2);
    expect(secA?.fields.map((f) => f.fieldKey)).toEqual(["a_field", "z_field"]);
    const aField = secA?.fields[0];
    expect(aField?.id).toBe("f_a_1");
    expect(aField?.placeholder).toBe("type here");
    expect(aField?.required).toBe(true);
    expect(aField?.validationRules).toEqual({ minLength: 3 });
    expect(aField?.createdAt).toBe(FIELD_TS.toISOString());

    expect(secB?.fields).toHaveLength(1);
    expect(secB?.fields[0]?.fieldType).toBe("dropdown");
    expect(secB?.fields[0]?.options).toEqual({
      choices: [
        { value: "x", label: "X" },
        { value: "y", label: "Y" },
      ],
    });
  });
});
