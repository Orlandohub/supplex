import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { qualificationWorkflows, workflowDocuments } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * DELETE /api/workflows/:workflowId/documents/:documentId
 * Remove document link from workflow (unlink, not delete)
 *
 * Auth: Requires Procurement Manager or Admin role
 * Tenant Scoping: Only works with workflows in user's tenant
 *
 * AC 10: Remove document link and set status back to Pending
 * Note: Does NOT delete document from storage (preserve audit trail)
 */
export const removeWorkflowDocumentRoute = new Elysia()
  .use(authenticate)
  .delete(
    "/:workflowId/documents/:documentId",
    async ({ params, user, set }) => {
      // Check role: Procurement Manager or Admin only (AC 10)
      if (
        !user?.role ||
        ![UserRole.PROCUREMENT_MANAGER, UserRole.ADMIN].includes(user.role)
      ) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message:
              "Access denied. Required role: Procurement Manager or Admin",
            timestamp: new Date().toISOString(),
          },
        };
      }

      try {
        const tenantId = user.tenantId as string;

        // Verify workflow exists and belongs to tenant
        const workflow = await db.query.qualificationWorkflows.findFirst({
          where: and(
            eq(qualificationWorkflows.id, params.workflowId),
            eq(qualificationWorkflows.tenantId, tenantId),
            isNull(qualificationWorkflows.deletedAt)
          ),
        });

        if (!workflow) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Workflow not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Find workflow_documents record
        const workflowDoc = await db.query.workflowDocuments.findFirst({
          where: and(
            eq(workflowDocuments.workflowId, params.workflowId),
            eq(workflowDocuments.documentId, params.documentId),
            isNull(workflowDocuments.deletedAt)
          ),
        });

        if (!workflowDoc) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Workflow document link not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Unlink document and reset status to Pending
        // Do NOT delete the document from documents table or storage (audit trail)
        await db
          .update(workflowDocuments)
          .set({
            documentId: null,
            status: "Pending",
            updatedAt: new Date(),
          })
          .where(eq(workflowDocuments.id, workflowDoc.id));

        return {
          success: true,
          data: {
            message: "Document removed from workflow",
          },
        };
      } catch (error: unknown) {
        console.error("Error removing workflow document:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to remove workflow document",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        workflowId: t.String({ format: "uuid" }),
        documentId: t.String({ format: "uuid" }),
      }),
      detail: {
        summary: "Remove document from workflow",
        description:
          "Unlinks document from workflow checklist item without deleting the document (Procurement Manager/Admin only)",
        tags: ["Workflows"],
      },
    }
  );
