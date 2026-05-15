/**
 * SUP-29: Workflow + process impact when a form template published head is superseded.
 */

import { eq, and, isNull, inArray, asc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../schema";
import { workflowStepTemplate } from "../schema/workflow-step-template";
import { workflowTemplate } from "../schema/workflow-template";
import { stepInstance } from "../schema/step-instance";
import { processInstance, ProcessStatus } from "../schema/process-instance";
import type {
  FormTemplatePublishImpact,
  PublishImpactProcessRef,
  PublishImpactWorkflowTemplateRef,
} from "@supplex/types";

type DbLike = PostgresJsDatabase<typeof schema>;

/**
 * Processes considered "active" for SUP-29 impact bucket B.
 * Excludes terminal states so completed/cancelled runs do not block preview signal noise.
 */
export const PUBLISH_IMPACT_ACTIVE_PROCESS_STATUSES = [
  "in_progress",
  "pending_validation",
  "declined_resubmit",
] as const;

export type PublishImpactActiveProcessStatus =
  (typeof PUBLISH_IMPACT_ACTIVE_PROCESS_STATUSES)[number];

export async function computeFormTemplatePublishImpact(
  db: DbLike,
  params: {
    formTemplateId: string;
    tenantId: string;
    /** Published head version id that will be superseded; null on first publish. */
    supersededPublishedVersionId: string | null;
  }
): Promise<FormTemplatePublishImpact> {
  const { formTemplateId, tenantId, supersededPublishedVersionId } = params;

  const workflowRows = await db
    .select({
      id: workflowTemplate.id,
      name: workflowTemplate.name,
    })
    .from(workflowStepTemplate)
    .innerJoin(
      workflowTemplate,
      eq(workflowStepTemplate.workflowTemplateId, workflowTemplate.id)
    )
    .where(
      and(
        eq(workflowStepTemplate.formTemplateId, formTemplateId),
        eq(workflowStepTemplate.tenantId, tenantId),
        isNull(workflowStepTemplate.deletedAt),
        eq(workflowTemplate.tenantId, tenantId),
        isNull(workflowTemplate.deletedAt)
      )
    )
    .groupBy(workflowTemplate.id, workflowTemplate.name)
    .orderBy(asc(workflowTemplate.name));

  const workflowTemplatesReferencingContainer: PublishImpactWorkflowTemplateRef[] =
    workflowRows.map((r) => ({ id: r.id, name: r.name }));

  let activeProcessesWithSupersededPin: PublishImpactProcessRef[] = [];

  if (supersededPublishedVersionId) {
    const activeStatuses = [
      ProcessStatus.IN_PROGRESS,
      ProcessStatus.PENDING_VALIDATION,
      ProcessStatus.DECLINED_RESUBMIT,
    ] as const;

    const procRows = await db
      .select({
        id: processInstance.id,
        workflowName: processInstance.workflowName,
        status: processInstance.status,
      })
      .from(stepInstance)
      .innerJoin(
        processInstance,
        eq(stepInstance.processInstanceId, processInstance.id)
      )
      .where(
        and(
          eq(
            stepInstance.pinnedFormTemplateVersionId,
            supersededPublishedVersionId
          ),
          eq(stepInstance.tenantId, tenantId),
          isNull(stepInstance.deletedAt),
          eq(processInstance.tenantId, tenantId),
          isNull(processInstance.deletedAt),
          inArray(processInstance.status, [...activeStatuses])
        )
      )
      .groupBy(
        processInstance.id,
        processInstance.workflowName,
        processInstance.status
      )
      .orderBy(asc(processInstance.id));

    activeProcessesWithSupersededPin = procRows.map((r) => ({
      id: r.id,
      workflowName: r.workflowName,
      status: r.status,
    }));
  }

  return {
    workflowTemplatesReferencingContainer,
    activeProcessesWithSupersededPin,
  };
}
