import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { qualificationWorkflows, workflowDocuments } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/workflows/:workflowId/documents
 * Get all workflow documents with full metadata
 *
 * Auth: Requires authenticated user
 * Tenant Scoping: Returns only documents for workflows in user's tenant
 *
 * AC 1, 2, 8: Returns workflow documents grouped by checklist item with metadata
 */
export const workflowDocumentsRoute = new Elysia().use(authenticate).get(
  "/:workflowId/documents",
  async ({ params, user, set }) => {
    try {
      const tenantId = user!.tenantId as string;

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

      // Fetch all workflow documents with joins to documents and users tables
      const workflowDocs = await db.query.workflowDocuments.findMany({
        where: and(
          eq(workflowDocuments.workflowId, params.workflowId),
          isNull(workflowDocuments.deletedAt)
        ),
        with: {
          document: {
            with: {
              uploadedByUser: true,
            },
          },
        },
      });

      // Transform to include uploader's full name
      const workflowDocumentsWithDetails = workflowDocs.map((wd) => ({
        id: wd.id,
        workflowId: wd.workflowId,
        checklistItemId: wd.checklistItemId,
        documentId: wd.documentId,
        status: wd.status,
        createdAt: wd.createdAt,
        updatedAt: wd.updatedAt,
        document: wd.document
          ? {
              id: wd.document.id,
              filename: wd.document.filename,
              documentType: wd.document.documentType,
              storagePath: wd.document.storagePath,
              fileSize: wd.document.fileSize,
              mimeType: wd.document.mimeType,
              description: wd.document.description,
              expiryDate: wd.document.expiryDate,
              uploadedBy: wd.document.uploadedBy,
              uploadedByName: wd.document.uploadedByUser?.fullName || "Unknown",
              createdAt: wd.document.createdAt,
              updatedAt: wd.document.updatedAt,
            }
          : null,
      }));

      return {
        success: true,
        data: {
          workflowDocuments: workflowDocumentsWithDetails,
        },
      };
    } catch (error: unknown) {
      console.error("Error fetching workflow documents:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch workflow documents",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    params: t.Object({
      workflowId: t.String({ format: "uuid" }),
    }),
    detail: {
      summary: "Get workflow documents",
      description:
        "Fetches all documents linked to a workflow with full metadata",
      tags: ["Workflows"],
    },
  }
);
