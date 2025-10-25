import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  qualificationWorkflows,
  qualificationStages,
  workflowDocuments,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import type { RequiredDocumentItem } from "@supplex/types";

/**
 * GET /api/workflows/:id/review
 * Get complete workflow data for review page
 *
 * Auth: Requires authenticated user
 * Authorization: User must be assigned to current stage
 * Tenant Scoping: Returns only workflows in user's tenant
 *
 * AC 3, 4, 5: Returns workflow, supplier, documents, stage, initiator for review
 */
export const reviewRoute = new Elysia().use(authenticate).get(
  "/:workflowId/review",
  async ({ params, user, set }) => {
    try {
      const userId = user!.id as string;
      const tenantId = user!.tenantId as string;

      // Fetch workflow with supplier and initiator
      const workflow = await db.query.qualificationWorkflows.findFirst({
        where: and(
          eq(qualificationWorkflows.id, params.workflowId),
          eq(qualificationWorkflows.tenantId, tenantId),
          isNull(qualificationWorkflows.deletedAt)
        ),
        with: {
          supplier: true,
          initiator: true,
        },
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

      // Get the current pending stage for this workflow assigned to current user
      const stage = await db.query.qualificationStages.findFirst({
        where: and(
          eq(qualificationStages.workflowId, params.workflowId),
          eq(qualificationStages.assignedTo, userId),
          eq(qualificationStages.status, "Pending"),
          isNull(qualificationStages.deletedAt)
        ),
      });

      if (!stage) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Not assigned to review this workflow",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Fetch all workflow documents with document and uploader details
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

      // Transform documents to include uploader info
      const documentsWithDetails = workflowDocs.map((wd) => ({
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

      // Parse snapshotted checklist
      let checklistItems: RequiredDocumentItem[] = [];
      if (workflow.snapshotedChecklist) {
        try {
          checklistItems = Array.isArray(workflow.snapshotedChecklist)
            ? (workflow.snapshotedChecklist as RequiredDocumentItem[])
            : [];
        } catch (error) {
          console.error("Failed to parse snapshotedChecklist:", error);
          checklistItems = [];
        }
      }

      // Return comprehensive review data
      return {
        success: true,
        data: {
          workflow: {
            ...workflow,
            checklistItems,
          },
          supplier: workflow.supplier,
          documents: documentsWithDetails,
          stage,
          initiator: {
            fullName: workflow.initiator?.fullName || "Unknown",
            email: workflow.initiator?.email || "",
          },
        },
      };
    } catch (error: unknown) {
      console.error("Error fetching workflow review data:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch workflow review data",
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
      summary: "Get workflow review data",
      description:
        "Fetches complete workflow data for review page (requires assignment)",
      tags: ["Workflows", "Tasks"],
    },
  }
);
