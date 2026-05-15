/**
 * SUP-29: Publish preview response — structure diff + publish impact DTOs.
 */

/** Field row slice aligned with canonical structure signature (GET form-templates/:id). */
export interface FormTemplateFieldStructureSlice {
  fieldOrder: number;
  fieldKey: string;
  label: string;
  placeholder: string | null;
  fieldType: string;
  required: boolean;
  validationRules: unknown;
  options: unknown;
}

/** Section row slice with ordered fields. */
export interface FormTemplateSectionStructureSlice {
  sectionOrder: number;
  sectionKey: string;
  title: string;
  fields: FormTemplateFieldStructureSlice[];
}

export interface FormTemplateFieldChangePair {
  fieldKey: string;
  before: FormTemplateFieldStructureSlice;
  after: FormTemplateFieldStructureSlice;
}

export interface FormTemplateModifiedSectionDiff {
  sectionKey: string;
  titleBefore: string;
  titleAfter: string;
  addedFields: FormTemplateFieldStructureSlice[];
  removedFields: Array<{ fieldKey: string; label: string }>;
  modifiedFields: FormTemplateFieldChangePair[];
}

export interface FormTemplateStructureDiff {
  addedSections: FormTemplateSectionStructureSlice[];
  removedSections: Array<{ sectionKey: string; title: string }>;
  modifiedSections: FormTemplateModifiedSectionDiff[];
}

/** Bounded summary for audit metadata (VERSION_PUBLISHED). */
export interface FormTemplateStructureDiffSummary {
  addedSectionCount: number;
  removedSectionCount: number;
  modifiedSectionCount: number;
  addedFieldCount: number;
  removedFieldCount: number;
  modifiedFieldCount: number;
}

export interface PublishImpactWorkflowTemplateRef {
  id: string;
  name: string;
}

export interface PublishImpactProcessRef {
  id: string;
  /** Display name from process instance (nullable in DB). */
  workflowName: string | null;
  status: string;
}

export interface FormTemplatePublishImpact {
  /** Workflow templates with at least one step using this form template container. */
  workflowTemplatesReferencingContainer: PublishImpactWorkflowTemplateRef[];
  /**
   * Active processes (allowlisted statuses) with any step pinned to the
   * superseded published version id. Empty when first publish (no superseded head).
   */
  activeProcessesWithSupersededPin: PublishImpactProcessRef[];
}

export interface FormTemplatePublishPreviewData {
  diff: FormTemplateStructureDiff;
  publishImpact: FormTemplatePublishImpact;
  /** Same comparison signal as GET template `hasUnpublishedDraftChanges` when both sides exist. */
  structureChanged: boolean;
  structureDiffSummary: FormTemplateStructureDiffSummary;
}
