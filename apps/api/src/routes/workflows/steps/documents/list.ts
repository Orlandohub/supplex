import { Elysia, t } from "elysia";
import { db } from "../../../../lib/db";
import {
  workflowStepDocument,
  stepInstance,
  processInstance,
  documents,
  workflowStepTemplate,
  documentTemplate,
} from "@supplex/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { authenticate } from "../../../../lib/rbac/middleware";

/**
 * GET /api/workflows/steps/:stepId/documents
 * List all required documents for a step with their upload/review status.
 */
export const listStepDocumentsRoute = new Elysia()
  .use(authenticate)
  .get(
    "/steps/:stepInstanceId/documents",
    async ({ params, user, set }) => {
      if (!user?.id || !user?.tenantId) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      const stepId = params.stepInstanceId;

      const [step] = await db
        .select()
        .from(stepInstance)
        .where(
          and(
            eq(stepInstance.id, stepId),
            eq(stepInstance.tenantId, user.tenantId)
          )
        );

      if (!step) {
        set.status = 404;
        return { success: false, error: "Step not found" };
      }

      const rows = await db
        .select({
          id: workflowStepDocument.id,
          requiredDocumentName: workflowStepDocument.requiredDocumentName,
          documentId: workflowStepDocument.documentId,
          status: workflowStepDocument.status,
          declineComment: workflowStepDocument.declineComment,
          reviewedBy: workflowStepDocument.reviewedBy,
          reviewedAt: workflowStepDocument.reviewedAt,
          createdAt: workflowStepDocument.createdAt,
          updatedAt: workflowStepDocument.updatedAt,
          // Joined document metadata
          filename: documents.filename,
          mimeType: documents.mimeType,
          fileSize: documents.fileSize,
          storagePath: documents.storagePath,
          expiryDate: workflowStepDocument.expiryDate,
        })
        .from(workflowStepDocument)
        .leftJoin(documents, eq(workflowStepDocument.documentId, documents.id))
        .where(
          and(
            eq(workflowStepDocument.stepInstanceId, stepId),
            eq(workflowStepDocument.tenantId, user.tenantId),
            isNull(workflowStepDocument.deletedAt)
          )
        )
        .orderBy(asc(workflowStepDocument.requiredDocumentName));

      // Also fetch the document template info for descriptions
      const workflowTemplateId = (
        (await db
          .select({ metadata: processInstance.metadata })
          .from(processInstance)
          .where(eq(processInstance.id, step.processInstanceId))
          .limit(1)
        )[0]?.metadata as any
      )?.workflowTemplateId;

      let requiredDocsInfo: { name: string; description?: string; required?: boolean; type?: string; expiryRequired?: boolean }[] = [];
      if (workflowTemplateId) {
        const [stepTmpl] = await db
          .select({
            documentTemplateId: workflowStepTemplate.documentTemplateId,
          })
          .from(workflowStepTemplate)
          .where(
            and(
              eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId),
              eq(workflowStepTemplate.tenantId, user.tenantId),
              eq(workflowStepTemplate.stepOrder, step.stepOrder),
              isNull(workflowStepTemplate.deletedAt)
            )
          );

        if (stepTmpl?.documentTemplateId) {
          const [docTmpl] = await db
            .select({ requiredDocuments: documentTemplate.requiredDocuments })
            .from(documentTemplate)
            .where(eq(documentTemplate.id, stepTmpl.documentTemplateId));

          if (docTmpl?.requiredDocuments) {
            requiredDocsInfo = docTmpl.requiredDocuments as any[];
          }
        }
      }

      const docsInfoMap = new Map(requiredDocsInfo.map((d) => [d.name, d]));

      const enrichedRows = rows.map((row) => {
        const info = docsInfoMap.get(row.requiredDocumentName);
        return {
          ...row,
          description: info?.description || null,
          required: info?.required ?? true,
          expiryRequired: info?.expiryRequired ?? false,
          documentType: info?.type || null,
        };
      });

      return {
        success: true,
        data: {
          stepId,
          stepName: step.stepName,
          stepStatus: step.status,
          documents: enrichedRows,
          summary: {
            total: enrichedRows.length,
            pending: enrichedRows.filter((d) => d.status === "pending").length,
            uploaded: enrichedRows.filter((d) => d.status === "uploaded").length,
            approved: enrichedRows.filter((d) => d.status === "approved").length,
            declined: enrichedRows.filter((d) => d.status === "declined").length,
          },
        },
      };
    },
    {
      params: t.Object({
        stepInstanceId: t.String({ format: "uuid" }),
      }),
    }
  );
