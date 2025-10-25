/**
 * POST /api/workflows/:id/submit
 * Submit workflow for Stage 1 approval
 */

import { Elysia, t } from "elysia";
import { authenticate } from "~/middleware/authenticate";
import { db } from "@supplex/db";
import {
  qualificationWorkflows,
  qualificationStages,
  workflowDocuments,
  suppliers,
  tenants,
  users,
} from "@supplex/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import type { RequiredDocumentItem } from "@supplex/types";
import { sendWorkflowSubmittedEmail } from "~/services/email-notification.service";

/**
 * Get Stage 1 reviewer based on tenant settings or fallback
 */
async function getStage1Reviewer(tenantId: string) {
  // Try tenant settings first
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (tenant?.settings?.workflowReviewers?.stage1) {
    const reviewer = await db.query.users.findFirst({
      where: and(
        eq(users.id, tenant.settings.workflowReviewers.stage1),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ),
    });
    if (reviewer) return reviewer;
  }

  // Fallback 1: First procurement manager
  const procurementManager = await db.query.users.findFirst({
    where: and(
      eq(users.tenantId, tenantId),
      eq(users.role, "procurement_manager"),
      eq(users.isActive, true)
    ),
  });
  if (procurementManager) return procurementManager;

  // Fallback 2: First admin
  const admin = await db.query.users.findFirst({
    where: and(
      eq(users.tenantId, tenantId),
      eq(users.role, "admin"),
      eq(users.isActive, true)
    ),
  });
  return admin;
}

export const submitRoute = new Elysia().use(authenticate).post(
  "/:id/submit",
  async ({ params, user, set }) => {
    // Role check with null-safe pattern
    if (
      !user?.role ||
      (user.role !== "procurement_manager" && user.role !== "admin")
    ) {
      set.status = 403;
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message:
            "Insufficient permissions. Procurement Manager or Admin role required.",
        },
      };
    }

    // Verify workflow exists and belongs to tenant
    const workflow = await db.query.qualificationWorkflows.findFirst({
      where: and(
        eq(qualificationWorkflows.id, params.id),
        eq(qualificationWorkflows.tenantId, user.tenantId),
        isNull(qualificationWorkflows.deletedAt)
      ),
      with: {
        supplier: true,
      },
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

    // Check workflow status is Draft
    if (workflow.status !== "Draft") {
      set.status = 400;
      return {
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Workflow must be in Draft status to submit",
        },
      };
    }

    // Check all required documents are uploaded
    const checklistItems = (workflow.snapshotedChecklist ||
      []) as RequiredDocumentItem[];
    const requiredItems = checklistItems.filter((item) => item.required);
    const requiredItemIds = requiredItems.map((item) => item.id);

    const uploadedDocs = await db.query.workflowDocuments.findMany({
      where: and(
        eq(workflowDocuments.workflowId, workflow.id),
        inArray(workflowDocuments.status, ["Uploaded", "Approved"])
      ),
    });

    // Get unique checklist item IDs that have documents
    const uploadedItemIds = new Set(
      uploadedDocs.map((doc) => doc.checklistItemId).filter(Boolean)
    );
    const allRequiredUploaded = requiredItemIds.every((id) =>
      uploadedItemIds.has(id || "")
    );

    if (!allRequiredUploaded) {
      set.status = 400;
      return {
        success: false,
        error: {
          code: "INCOMPLETE_DOCUMENTS",
          message: "All required documents must be uploaded before submission",
        },
      };
    }

    // Get assigned reviewer (from tenant settings or fallback)
    const reviewer = await getStage1Reviewer(user.tenantId);
    if (!reviewer) {
      set.status = 500;
      return {
        success: false,
        error: {
          code: "NO_REVIEWER",
          message: "No reviewer available for Stage 1",
        },
      };
    }

    // Begin transaction
    const result = await db.transaction(async (tx) => {
      // Update workflow
      const updatedWorkflows = await tx
        .update(qualificationWorkflows)
        .set({
          status: "Stage1",
          currentStage: 1,
          updatedAt: new Date(),
        })
        .where(eq(qualificationWorkflows.id, workflow.id))
        .returning();

      // Create Stage 1 record
      const stages = await tx
        .insert(qualificationStages)
        .values({
          workflowId: workflow.id,
          stageNumber: 1,
          stageName: "Procurement Review",
          assignedTo: reviewer.id,
          status: "Pending",
        })
        .returning();

      // Update supplier status
      const updatedSuppliers = await tx
        .update(suppliers)
        .set({
          status: "qualified",
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, workflow.supplierId))
        .returning();

      // TODO: Story 2.10 will add audit log entry
      // await createAuditLog(tx, {
      //   event: "workflow_submitted",
      //   workflowId: workflow.id,
      //   userId: user.id,
      //   details: { stage: 1, assigned_to: reviewer.id },
      // });

      return {
        workflow: updatedWorkflows[0],
        stage: stages[0],
        supplier: updatedSuppliers[0],
      };
    });

    // Queue email notification (stub for Story 2.8)
    await sendWorkflowSubmittedEmail({
      workflowId: workflow.id,
      reviewerId: reviewer.id,
      reviewerEmail: reviewer.email,
      initiatorName: user.fullName || user.email,
      supplierName: workflow.supplier?.name || "Unknown Supplier",
      riskScore: workflow.riskScore || "0.00",
      workflowLink: `${process.env.WEB_URL || "http://localhost:3000"}/workflows/${workflow.id}`,
    });

    set.status = 200;
    return {
      success: true,
      data: result,
    };
  },
  {
    params: t.Object({
      id: t.String({ format: "uuid" }),
    }),
  }
);
