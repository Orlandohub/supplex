import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import {
  db,
  tenants,
  users,
  formTemplate,
  formSection,
  formField,
  FormTemplateStatus,
  FieldType,
  workflowTemplate,
  workflowStepTemplate,
  processInstance,
  stepInstance,
  insertDraftFormTemplateVersion,
  publishFormTemplateFromDraft,
  getPublishedHeadFormTemplateVersion,
  computeFormTemplatePublishImpact,
  ProcessStatus,
  ProcessType,
} from "../../index";

/**
 * SUP-29 publish impact queries — requires DATABASE_URL + migrations through 0044.
 */
describe("computeFormTemplatePublishImpact (SUP-29)", () => {
  let tenantId: string;
  let actorUserId: string;

  beforeAll(async () => {
    const [t] = await db
      .insert(tenants)
      .values({
        name: "Impact Test Tenant",
        slug: `impact-tenant-${Date.now()}`,
      })
      .returning();
    if (!t) throw new Error("tenant");
    tenantId = t.id;

    const [u] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        email: `impact-${Date.now()}@test.com`,
        fullName: "Impact User",
        role: "admin",
      })
      .returning();
    if (!u) throw new Error("user");
    actorUserId = u.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  test("bucket A lists workflow templates referencing form container", async () => {
    const [tpl] = await db
      .insert(formTemplate)
      .values({
        tenantId,
        name: `Impact form ${Date.now()}`,
        status: FormTemplateStatus.DRAFT,
      })
      .returning();
    if (!tpl) throw new Error("tpl");

    const [wt] = await db
      .insert(workflowTemplate)
      .values({
        tenantId,
        name: "WF with form step",
        createdBy: actorUserId,
        status: "published",
      })
      .returning();
    if (!wt) throw new Error("wt");

    await db.insert(workflowStepTemplate).values({
      workflowTemplateId: wt.id,
      tenantId,
      stepOrder: 1,
      name: "Fill form",
      stepType: "form",
      formTemplateId: tpl.id,
      formActionMode: "fill_out",
    });

    const impact = await computeFormTemplatePublishImpact(db, {
      formTemplateId: tpl.id,
      tenantId,
      supersededPublishedVersionId: null,
    });

    expect(impact.workflowTemplatesReferencingContainer).toEqual([
      { id: wt.id, name: "WF with form step" },
    ]);
    expect(impact.activeProcessesWithSupersededPin.length).toBe(0);

    await db.delete(workflowTemplate).where(eq(workflowTemplate.id, wt.id));
    await db.delete(formTemplate).where(eq(formTemplate.id, tpl.id));
  });

  test("bucket B lists active process when step pins superseded published version", async () => {
    const [tpl] = await db
      .insert(formTemplate)
      .values({
        tenantId,
        name: `Pin impact ${Date.now()}`,
        status: FormTemplateStatus.DRAFT,
      })
      .returning();
    if (!tpl) throw new Error("tpl");

    const draft0 = await insertDraftFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId,
    });

    const [sec] = await db
      .insert(formSection)
      .values({
        formTemplateId: tpl.id,
        formTemplateVersionId: draft0.id,
        tenantId,
        sectionOrder: 1,
        sectionKey: "sec_impact",
        title: "S",
      })
      .returning();
    if (!sec) throw new Error("section");

    await db.insert(formField).values({
      formSectionId: sec.id,
      formTemplateVersionId: draft0.id,
      tenantId,
      fieldOrder: 1,
      fieldKey: "f1",
      fieldType: FieldType.TEXT,
      label: "L",
    });

    await db.transaction(async (tx) => {
      await publishFormTemplateFromDraft(tx, {
        formTemplateId: tpl.id,
        tenantId,
        actorUserId,
      });
    });

    const head = await getPublishedHeadFormTemplateVersion(db, {
      formTemplateId: tpl.id,
      tenantId,
    });
    if (!head) throw new Error("expected published head");

    const [proc] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: ProcessType.SUPPLIER_QUALIFICATION,
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: ProcessStatus.IN_PROGRESS,
        workflowTemplateId: null,
        initiatedBy: actorUserId,
      })
      .returning();
    if (!proc) throw new Error("proc");

    await db.insert(stepInstance).values({
      tenantId,
      processInstanceId: proc.id,
      stepOrder: 1,
      stepName: "Form step",
      stepType: "form",
      pinnedFormTemplateVersionId: head.id,
      status: "pending",
    });

    const impact = await computeFormTemplatePublishImpact(db, {
      formTemplateId: tpl.id,
      tenantId,
      supersededPublishedVersionId: head.id,
    });

    expect(impact.activeProcessesWithSupersededPin.length).toBe(1);
    expect(impact.activeProcessesWithSupersededPin[0]?.id).toBe(proc.id);

    const [completeProc] = await db
      .insert(processInstance)
      .values({
        tenantId,
        processType: ProcessType.SUPPLIER_QUALIFICATION,
        entityType: "supplier",
        entityId: crypto.randomUUID(),
        status: ProcessStatus.COMPLETE,
        workflowTemplateId: null,
        initiatedBy: actorUserId,
      })
      .returning();
    if (!completeProc) throw new Error("completeProc");

    await db.insert(stepInstance).values({
      tenantId,
      processInstanceId: completeProc.id,
      stepOrder: 1,
      stepName: "Done",
      stepType: "form",
      pinnedFormTemplateVersionId: head.id,
      status: "pending",
    });

    const impact2 = await computeFormTemplatePublishImpact(db, {
      formTemplateId: tpl.id,
      tenantId,
      supersededPublishedVersionId: head.id,
    });

    expect(impact2.activeProcessesWithSupersededPin.length).toBe(1);

    await db.delete(processInstance).where(eq(processInstance.id, proc.id));
    await db
      .delete(processInstance)
      .where(eq(processInstance.id, completeProc.id));
  });
});
