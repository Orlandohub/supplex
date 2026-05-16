import { describe, test, expect } from "bun:test";
import {
  buildFormTemplateCompiledJsonFromRelationalSubtree,
  type FormCompileFieldInput,
  type FormCompileSectionInput,
} from "../form-template-compile-published";
import {
  parseFormTemplateCompiledJson,
  tryReadStructureFromCompiledJson,
} from "../form-template-compiled-json-parse";
import type {
  FormTemplateCompiledJsonV1,
  FormTemplateCompiledJsonV2,
} from "@supplex/types";

const TS = new Date("2024-06-01T12:00:00.000Z");

const section: FormCompileSectionInput = {
  id: "11111111-1111-4111-8111-111111111111",
  sectionOrder: 1,
  sectionKey: "intro",
  slugManuallyEdited: false,
  title: "Intro",
  description: null,
  metadata: { layout: "wide" },
  createdAt: TS,
  updatedAt: TS,
};

const field: FormCompileFieldInput = {
  id: "22222222-2222-4222-8222-222222222222",
  formSectionId: section.id,
  fieldOrder: 1,
  fieldKey: "name",
  slugManuallyEdited: false,
  fieldType: "text",
  label: "Name",
  placeholder: null,
  required: true,
  validationRules: { minLength: 1 },
  options: {},
  createdAt: TS,
  updatedAt: TS,
};

function buildSample(): FormTemplateCompiledJsonV2 {
  const fieldsBySection = new Map<string, FormCompileFieldInput[]>();
  fieldsBySection.set(section.id, [field]);
  const compiled = buildFormTemplateCompiledJsonFromRelationalSubtree(
    [section],
    fieldsBySection
  );
  if (compiled.schemaVersion !== 2) {
    throw new Error("expected v2 sample");
  }
  return compiled;
}

const ctx = {
  tenantId: "tenant-uuid",
  formTemplateId: "template-uuid",
  formTemplateVersionId: "version-uuid",
};

describe("parseFormTemplateCompiledJson (SUP-38)", () => {
  test("returns missing when null/undefined", () => {
    expect(parseFormTemplateCompiledJson(null)).toEqual({
      ok: false,
      reason: "compiled_json_missing",
      schemaVersion: null,
    });
    expect(parseFormTemplateCompiledJson(undefined)).toEqual({
      ok: false,
      reason: "compiled_json_missing",
      schemaVersion: null,
    });
  });

  test("returns malformed for non-objects", () => {
    expect(parseFormTemplateCompiledJson(42)).toMatchObject({
      ok: false,
      reason: "compiled_json_malformed",
    });
    expect(parseFormTemplateCompiledJson("v2")).toMatchObject({
      ok: false,
      reason: "compiled_json_malformed",
    });
    expect(parseFormTemplateCompiledJson([])).toMatchObject({
      ok: false,
      reason: "compiled_json_malformed",
    });
  });

  test("returns malformed when v2 payload is missing sections", () => {
    const sample = buildSample();
    const broken = { ...sample, sections: undefined } as unknown;
    expect(parseFormTemplateCompiledJson(broken)).toMatchObject({
      ok: false,
      reason: "compiled_json_malformed",
      schemaVersion: 2,
    });
  });

  test("classifies v1 payloads but reports unsupported for read", () => {
    const v1: FormTemplateCompiledJsonV1 = {
      schemaVersion: 1,
      fieldByKey: {},
      orderedWalk: [],
      validationPlan: { placeholder: true },
    };
    const parsed = parseFormTemplateCompiledJson(v1);
    expect(parsed).toEqual({ ok: true, payload: v1, schemaVersion: 1 });

    const result = tryReadStructureFromCompiledJson(v1, ctx);
    expect(result).toEqual({
      structure: null,
      reason: "compiled_json_unsupported_schema_version",
      schemaVersion: 1,
    });
  });

  test("flags unknown schemaVersion as unsupported", () => {
    const future = { schemaVersion: 99 } as unknown;
    expect(parseFormTemplateCompiledJson(future)).toMatchObject({
      ok: false,
      reason: "compiled_json_unsupported_schema_version",
      schemaVersion: 99,
    });
  });
});

describe("tryReadStructureFromCompiledJson (SUP-38)", () => {
  test("materializes v2 payload into Drizzle row shapes", () => {
    const sample = buildSample();
    const result = tryReadStructureFromCompiledJson(sample, ctx);

    expect(result.reason).toBeNull();
    expect(result.schemaVersion).toBe(2);
    expect(result.structure).not.toBeNull();
    if (!result.structure) throw new Error("expected structure");

    expect(result.structure.sections).toHaveLength(1);
    const sec = result.structure.sections[0];
    expect(sec).toBeDefined();
    if (!sec) throw new Error("missing section row");
    expect(sec.id).toBe(section.id);
    expect(sec.tenantId).toBe(ctx.tenantId);
    expect(sec.formTemplateId).toBe(ctx.formTemplateId);
    expect(sec.formTemplateVersionId).toBe(ctx.formTemplateVersionId);
    expect(sec.deletedAt).toBeNull();
    expect(sec.createdAt instanceof Date).toBe(true);
    expect(sec.metadata).toEqual({ layout: "wide" });

    expect(result.structure.fields).toHaveLength(1);
    const f = result.structure.fields[0];
    expect(f).toBeDefined();
    if (!f) throw new Error("missing field row");
    expect(f.id).toBe(field.id);
    expect(f.fieldKey).toBe("name");
    expect(f.required).toBe(true);
    expect(f.validationRules).toEqual({ minLength: 1 });
    expect(f.formSectionId).toBe(section.id);
    expect(f.formTemplateVersionId).toBe(ctx.formTemplateVersionId);
    expect(f.deletedAt).toBeNull();
    expect(f.createdAt instanceof Date).toBe(true);
  });

  test("falls back when sections elements have wrong shape", () => {
    const sample = buildSample();
    const broken = {
      ...sample,
      sections: [{ ...sample.sections[0], fields: [{ id: 1 }] }],
    } as unknown;
    const result = tryReadStructureFromCompiledJson(broken, ctx);
    expect(result.structure).toBeNull();
    expect(result.reason).toBe("compiled_json_malformed");
  });
});
