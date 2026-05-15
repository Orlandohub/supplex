import { describe, test, expect } from "bun:test";
import type { FormTemplateSectionStructureSlice } from "@supplex/types";
import {
  diffFormTemplateStructureSnapshots,
  formTemplateStructureSignatureFromSlices,
  summarizeFormTemplateStructureDiffAccurate,
  structureChangedFromDiff,
} from "../form-template-structure-diff";

function sec(
  sectionKey: string,
  title: string,
  fields: Array<{
    fieldKey: string;
    label: string;
    fieldType?: string;
  }>,
  sectionOrder = 1
): FormTemplateSectionStructureSlice {
  return {
    sectionOrder,
    sectionKey,
    title,
    fields: fields.map((f, i) => ({
      fieldOrder: i + 1,
      fieldKey: f.fieldKey,
      label: f.label,
      placeholder: null,
      fieldType: f.fieldType ?? "text",
      required: false,
      validationRules: {},
      options: {},
    })),
  };
}

describe("form-template-structure-diff (SUP-29)", () => {
  test("first-publish style: all sections added vs empty baseline", () => {
    const baseline: FormTemplateSectionStructureSlice[] = [];
    const draft = [sec("s1", "Intro", [{ fieldKey: "f1", label: "Name" }])];

    const diff = diffFormTemplateStructureSnapshots(baseline, draft);
    expect(diff.addedSections.length).toBe(1);
    expect(diff.removedSections.length).toBe(0);
    expect(diff.modifiedSections.length).toBe(0);
    expect(structureChangedFromDiff(diff)).toBe(true);

    const summary = summarizeFormTemplateStructureDiffAccurate(diff, baseline);
    expect(summary.addedSectionCount).toBe(1);
    expect(summary.addedFieldCount).toBe(1);
    expect(summary.removedSectionCount).toBe(0);
  });

  test("golden signature stability: same slices stringify like GET payload ordering", () => {
    const a = [
      sec(
        "main",
        "Main",
        [
          { fieldKey: "a", label: "A" },
          { fieldKey: "b", label: "B" },
        ],
        2
      ),
      sec("meta", "Meta", [{ fieldKey: "m", label: "M" }], 1),
    ];
    const b = [
      sec("meta", "Meta", [{ fieldKey: "m", label: "M" }], 1),
      sec(
        "main",
        "Main",
        [
          { fieldKey: "a", label: "A" },
          { fieldKey: "b", label: "B" },
        ],
        2
      ),
    ];
    expect(formTemplateStructureSignatureFromSlices(a)).toBe(
      formTemplateStructureSignatureFromSlices(b)
    );
  });

  test("modified field detected when label changes", () => {
    const baseline = [sec("s1", "S", [{ fieldKey: "f1", label: "Old" }])];
    const draft = [sec("s1", "S", [{ fieldKey: "f1", label: "New" }])];

    const diff = diffFormTemplateStructureSnapshots(baseline, draft);
    expect(diff.modifiedSections.length).toBe(1);
    const m = diff.modifiedSections[0];
    expect(m?.modifiedFields.length).toBe(1);
    expect(m?.modifiedFields[0]?.fieldKey).toBe("f1");
    expect(m?.modifiedFields[0]?.before.label).toBe("Old");
    expect(m?.modifiedFields[0]?.after.label).toBe("New");
  });

  test("section removed lists title", () => {
    const baseline = [
      sec("gone", "Removed", [{ fieldKey: "x", label: "X" }]),
      sec("stay", "Stay", []),
    ];
    const draft = [sec("stay", "Stay", [])];

    const diff = diffFormTemplateStructureSnapshots(baseline, draft);
    expect(diff.removedSections).toEqual([
      { sectionKey: "gone", title: "Removed" },
    ]);
    const summary = summarizeFormTemplateStructureDiffAccurate(diff, baseline);
    expect(summary.removedFieldCount).toBe(1);
  });
});
