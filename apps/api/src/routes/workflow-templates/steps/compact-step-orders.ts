import { workflowStepTemplate, type DbOrTx } from "@supplex/db";
import { and, asc, eq, isNull } from "drizzle-orm";

/**
 * Renumber a workflow template's surviving step_order values to a contiguous
 * 1..n sequence.
 *
 * Workflow instantiation and step transitions assume `step_order = 1` is the
 * first step and that orders are contiguous (see `instantiate-workflow.ts`,
 * `transition-to-next-step.ts`, `return-to-previous-step.ts`). Soft-deleting
 * a step in the middle would otherwise leave gaps, so callers run this
 * helper inside the same transaction as the delete to keep the invariant.
 */
export async function compactWorkflowTemplateStepOrders(
  tx: DbOrTx,
  templateId: string,
  tenantId: string,
  now: Date = new Date()
): Promise<void> {
  const remainingSteps = await tx
    .select({ id: workflowStepTemplate.id })
    .from(workflowStepTemplate)
    .where(
      and(
        eq(workflowStepTemplate.workflowTemplateId, templateId),
        eq(workflowStepTemplate.tenantId, tenantId),
        isNull(workflowStepTemplate.deletedAt)
      )
    )
    .orderBy(asc(workflowStepTemplate.stepOrder));

  for (let i = 0; i < remainingSteps.length; i++) {
    const remaining = remainingSteps[i];
    if (!remaining) continue;
    await tx
      .update(workflowStepTemplate)
      .set({
        stepOrder: i + 1,
        updatedAt: now,
      })
      .where(eq(workflowStepTemplate.id, remaining.id));
  }
}
