/**
 * GET /api/workflows/:id/completion-status
 * Returns workflow document completion status
 */

import { Elysia, t } from "elysia";
import { authenticate } from "~/middleware/authenticate";
import { db } from "@supplex/db";
import { qualificationWorkflows, workflowDocuments } from "@supplex/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import type { RequiredDocumentItem } from "@supplex/types";

export const completionStatusRoute = new Elysia().use(authenticate).get(
  "/:id/completion-status",
  async ({ params, user, set }) => {
    // Verify workflow exists and belongs to user's tenant
    const workflow = await db.query.qualificationWorkflows.findFirst({
      where: and(
        eq(qualificationWorkflows.id, params.id),
        eq(qualificationWorkflows.tenantId, user.tenantId),
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
        },
      };
    }

    // Parse snapshotted checklist to get required documents
    const checklistItems = (workflow.snapshotedChecklist ||
      []) as RequiredDocumentItem[];
    const requiredItems = checklistItems.filter((item) => item.required);
    const requiredCount = requiredItems.length;

    // Get uploaded documents for this workflow
    const uploadedDocs = await db.query.workflowDocuments.findMany({
      where: and(
        eq(workflowDocuments.workflowId, workflow.id),
        inArray(workflowDocuments.status, ["Uploaded", "Approved"])
      ),
    });

    // Get unique checklist item IDs that have uploaded documents
    const uploadedItemIds = new Set(
      uploadedDocs.map((doc) => doc.checklistItemId).filter(Boolean)
    );

    // Count how many required items have been uploaded
    const uploadedCount = requiredItems.filter((item) =>
      uploadedItemIds.has(item.id || "")
    ).length;

    // Calculate completion percentage
    const completionPercentage =
      requiredCount > 0
        ? Math.round((uploadedCount / requiredCount) * 100)
        : 100;

    // Get list of missing required documents
    const missingDocuments = requiredItems
      .filter((item) => !uploadedItemIds.has(item.id || ""))
      .map((item) => item.name);

    // Can submit if all required documents are uploaded
    const canSubmit = uploadedCount >= requiredCount && requiredCount > 0;

    set.status = 200;
    return {
      success: true,
      data: {
        canSubmit,
        requiredCount,
        uploadedCount,
        completionPercentage,
        missingDocuments,
      },
    };
  },
  {
    params: t.Object({
      id: t.String({ format: "uuid" }),
    }),
  }
);
