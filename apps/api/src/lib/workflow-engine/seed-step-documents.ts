/**
 * Seed Workflow Step Documents
 * Story: 2.2.17 - Workflow Document Upload
 *
 * When a document step activates, create one workflow_step_document row
 * per required document in the linked document template.
 */

import { db as defaultDb } from "../db";
import {
  workflowStepDocument,
  workflowStepTemplate,
  documentTemplate,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

interface RequiredDocumentItem {
  name: string;
  description?: string;
  required?: boolean;
  type?: string;
}

export async function seedStepDocuments(
  stepInstanceId: string,
  processInstanceId: string,
  workflowStepTemplateId: string,
  tenantId: string,
  db: NodePgDatabase<any> = defaultDb
): Promise<number> {
  const [stepTmpl] = await db
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

  const [docTmpl] = await db
    .select({ requiredDocuments: documentTemplate.requiredDocuments })
    .from(documentTemplate)
    .where(eq(documentTemplate.id, stepTmpl.documentTemplateId));

  if (!docTmpl?.requiredDocuments) return 0;

  const requiredDocs = docTmpl.requiredDocuments as RequiredDocumentItem[];
  if (requiredDocs.length === 0) return 0;

  // Check if rows already exist (idempotency for re-activation after decline)
  const existing = await db
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

  await db.insert(workflowStepDocument).values(
    toInsert.map((doc) => ({
      tenantId,
      processInstanceId,
      stepInstanceId,
      requiredDocumentName: doc.name,
      status: "pending" as const,
    }))
  );

  console.log(
    `[seedStepDocuments] Seeded ${toInsert.length} document rows for step ${stepInstanceId}`
  );
  return toInsert.length;
}
