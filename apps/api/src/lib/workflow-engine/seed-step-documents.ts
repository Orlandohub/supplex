/**
 * Seed Workflow Step Documents
 * Story: 2.2.17 - Workflow Document Upload
 * Updated: Story 2.2.19 - Transaction threading (tx required)
 *
 * When a document step activates, create one workflow_step_document row
 * per required document in the linked document template.
 */

import type { DbOrTx } from "@supplex/db";
import {
  workflowStepDocument,
  workflowStepTemplate,
  documentTemplate,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import type { Logger } from "pino";
import type { RequiredDocumentItem } from "@supplex/types";
import defaultLogger from "../logger";

export async function seedStepDocuments(
  tx: DbOrTx,
  stepInstanceId: string,
  processInstanceId: string,
  workflowStepTemplateId: string,
  tenantId: string,
  log?: Logger
): Promise<number> {
  const [stepTmpl] = await tx
    .select({
      documentTemplateId: workflowStepTemplate.documentTemplateId,
      stepType: workflowStepTemplate.stepType,
    })
    .from(workflowStepTemplate)
    .where(
      and(
        eq(workflowStepTemplate.id, workflowStepTemplateId),
        eq(workflowStepTemplate.tenantId, tenantId),
        isNull(workflowStepTemplate.deletedAt)
      )
    );

  if (!stepTmpl || stepTmpl.stepType !== "document" || !stepTmpl.documentTemplateId) {
    return 0;
  }

  const [docTmpl] = await tx
    .select({ requiredDocuments: documentTemplate.requiredDocuments })
    .from(documentTemplate)
    .where(eq(documentTemplate.id, stepTmpl.documentTemplateId));

  if (!docTmpl?.requiredDocuments) return 0;

  const requiredDocs = docTmpl.requiredDocuments as RequiredDocumentItem[];
  if (requiredDocs.length === 0) return 0;

  const existing = await tx
    .select({ requiredDocumentName: workflowStepDocument.requiredDocumentName })
    .from(workflowStepDocument)
    .where(
      and(
        eq(workflowStepDocument.stepInstanceId, stepInstanceId),
        eq(workflowStepDocument.tenantId, tenantId),
        isNull(workflowStepDocument.deletedAt)
      )
    );

  const existingNames = new Set(existing.map((e) => e.requiredDocumentName));
  const toInsert = requiredDocs.filter((d) => !existingNames.has(d.name));

  if (toInsert.length === 0) return 0;

  await tx.insert(workflowStepDocument).values(
    toInsert.map((doc) => ({
      tenantId,
      processInstanceId,
      stepInstanceId,
      requiredDocumentName: doc.name,
      status: "pending" as const,
    }))
  );

  const seedLog = (log || defaultLogger).child({ action: "seedStepDocuments", tenantId, stepId: stepInstanceId });
  seedLog.info({ seededCount: toInsert.length }, "seeded document rows for step");
  return toInsert.length;
}
