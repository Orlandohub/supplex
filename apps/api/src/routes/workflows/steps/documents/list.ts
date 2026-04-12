import { Elysia, t } from "elysia";
import { db } from "../../../../lib/db";
import {
  workflowStepDocument,
  stepInstance,
  processInstance,
  documents,
  workflowStepTemplate,
  documentTemplate,
  documentReviewDecision,
  taskInstance,
  users,
} from "@supplex/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import type { RequiredDocumentItem } from "@supplex/types";
import { authenticate } from "../../../../lib/rbac/middleware";
import { verifyStepProcessAccess } from "../../../../lib/rbac/entity-authorization";
import { Errors } from "../../../../lib/errors";

/**
 * GET /api/workflows/steps/:stepId/documents
 * List all required documents for a step with their upload/review status.
 * Includes per-reviewer decisions for the current validation round.
 */
export const listStepDocumentsRoute = new Elysia()
  .use(authenticate)
  .get(
    "/steps/:stepInstanceId/documents",
    async ({ params, user }) => {
      if (!user?.id || !user?.tenantId) {
        throw Errors.unauthorized("Unauthorized");
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
        throw Errors.notFound("Step not found");
      }

      const access = await verifyStepProcessAccess(user, stepId, db);
      if (!access.allowed) {
        throw Errors.forbidden(access.reason || "Access denied");
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

      const [proc] = await db
        .select({ workflowTemplateId: processInstance.workflowTemplateId })
        .from(processInstance)
        .where(eq(processInstance.id, step.processInstanceId))
        .limit(1);
      const workflowTemplateId = proc?.workflowTemplateId;

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
            requiredDocsInfo = docTmpl.requiredDocuments as RequiredDocumentItem[];
          }
        }
      }

      const docsInfoMap = new Map(requiredDocsInfo.map((d) => [d.name, d]));

      // Fetch current-round reviewer decisions
      const currentRound = step.validationRound;
      let decisionRows: {
        workflowStepDocumentId: string;
        reviewerUserId: string;
        decision: string;
        comment: string | null;
        decidedAt: Date;
        taskInstanceId: string;
        reviewerName: string | null;
        assigneeRole: string | null;
      }[] = [];

      if (currentRound > 0) {
        decisionRows = await db
          .select({
            workflowStepDocumentId: documentReviewDecision.workflowStepDocumentId,
            reviewerUserId: documentReviewDecision.reviewerUserId,
            decision: documentReviewDecision.decision,
            comment: documentReviewDecision.comment,
            decidedAt: documentReviewDecision.decidedAt,
            taskInstanceId: documentReviewDecision.taskInstanceId,
            reviewerName: users.fullName,
            assigneeRole: taskInstance.assigneeRole,
          })
          .from(documentReviewDecision)
          .innerJoin(users, eq(documentReviewDecision.reviewerUserId, users.id))
          .innerJoin(taskInstance, eq(documentReviewDecision.taskInstanceId, taskInstance.id))
          .where(
            and(
              eq(documentReviewDecision.stepInstanceId, stepId),
              eq(documentReviewDecision.validationRound, currentRound)
            )
          );
      }

      // Group decisions by document
      const decisionsByDoc = new Map<string, typeof decisionRows>();
      for (const row of decisionRows) {
        if (!decisionsByDoc.has(row.workflowStepDocumentId)) {
          decisionsByDoc.set(row.workflowStepDocumentId, []);
        }
        decisionsByDoc.get(row.workflowStepDocumentId)!.push(row);
      }

      const enrichedRows = rows.map((row) => {
        const info = docsInfoMap.get(row.requiredDocumentName);
        const docDecisions = decisionsByDoc.get(row.id) || [];
        return {
          ...row,
          description: info?.description || null,
          required: info?.required ?? true,
          expiryRequired: info?.expiryRequired ?? false,
          documentType: info?.type || null,
          reviewerDecisions: docDecisions.map((d) => ({
            reviewerUserId: d.reviewerUserId,
            reviewerName: d.reviewerName || "Unknown",
            reviewerRole: d.assigneeRole || "unknown",
            decision: d.decision as "approved" | "declined",
            comment: d.comment,
            decidedAt: d.decidedAt.toISOString(),
            taskInstanceId: d.taskInstanceId,
          })),
        };
      });

      return {
        success: true,
        data: {
          stepId,
          stepName: step.stepName,
          stepStatus: step.status,
          validationRound: currentRound,
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
