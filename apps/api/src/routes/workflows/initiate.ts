import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  qualificationWorkflows,
  workflowDocuments,
  suppliers,
  documentChecklists,
  WorkflowStatus,
  ChecklistItemStatus,
  auditLogs,
} from "@supplex/db";
import { eq, and, isNull, notInArray } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole, calculateRiskScore } from "@supplex/types";
import { createAuditContext } from "../../lib/audit/logger";
import { AuditAction } from "@supplex/types";

/**
 * POST /api/workflows/initiate
 * Initiate a qualification workflow for a supplier
 *
 * Auth: Requires Procurement Manager or Admin role
 * Tenant Scoping: Automatically sets tenant_id from authenticated user's JWT
 *
 * AC 1-12: Full workflow initiation with validation, snapshotting, and audit logging
 */
export const initiateWorkflowRoute = new Elysia({ prefix: "/workflows" })
  .use(authenticate)
  .post(
    "/initiate",
    async ({ body, user, set, headers }) => {
      // Check role: Procurement Manager or Admin only (AC 1)
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
        const userId = user.id as string;

        // Verify supplier exists and belongs to tenant
        const supplier = await db.query.suppliers.findFirst({
          where: and(
            eq(suppliers.id, body.supplierId),
            eq(suppliers.tenantId, tenantId),
            isNull(suppliers.deletedAt)
          ),
        });

        if (!supplier) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Supplier not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Verify supplier status is "Prospect" (AC 1)
        if (supplier.status !== "prospect") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_STATUS",
              message:
                "Supplier must be in Prospect status to initiate qualification workflow",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Check for existing active workflow (AC 12)
        const activeWorkflow = await db.query.qualificationWorkflows.findFirst({
          where: and(
            eq(qualificationWorkflows.supplierId, body.supplierId),
            eq(qualificationWorkflows.tenantId, tenantId),
            notInArray(qualificationWorkflows.status, [
              WorkflowStatus.APPROVED,
              WorkflowStatus.REJECTED,
            ]),
            isNull(qualificationWorkflows.deletedAt)
          ),
        });

        if (activeWorkflow) {
          set.status = 409;
          return {
            success: false,
            error: {
              code: "CONFLICT",
              message: "Supplier already has an active qualification workflow",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Fetch selected checklist template
        const checklist = await db.query.documentChecklists.findFirst({
          where: and(
            eq(documentChecklists.id, body.checklistId),
            eq(documentChecklists.tenantId, tenantId),
            isNull(documentChecklists.deletedAt)
          ),
        });

        if (!checklist) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Document checklist template not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Calculate overall risk score (AC 5)
        const riskScore = calculateRiskScore(body.riskAssessment);

        // Snapshot checklist: Copy required_documents from template (AC 7)
        const snapshotedChecklist = Array.isArray(checklist.requiredDocuments)
          ? checklist.requiredDocuments
          : [];

        // Wrap all operations in a transaction for atomicity
        const newWorkflow = await db.transaction(async (tx) => {
          // Create workflow record with snapshotted checklist
          const workflowResult = await tx
            .insert(qualificationWorkflows)
            .values({
              tenantId,
              supplierId: body.supplierId,
              status: WorkflowStatus.DRAFT,
              currentStage: 0,
              riskScore,
              initiatedBy: userId,
              initiatedDate: new Date(),
              snapshotedChecklist: snapshotedChecklist as any,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          const workflow = workflowResult[0];

          // Create workflow_documents records for each checklist item
          if (snapshotedChecklist.length > 0) {
            const workflowDocs = snapshotedChecklist.map((item) => ({
              workflowId: workflow.id,
              checklistItemId: item.id || crypto.randomUUID(),
              status: ChecklistItemStatus.PENDING,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            await tx.insert(workflowDocuments).values(workflowDocs);
          }

          // Update supplier status: Prospect → Qualified
          await tx
            .update(suppliers)
            .set({
              status: "qualified",
              updatedAt: new Date(),
            })
            .where(eq(suppliers.id, body.supplierId));

          // Create audit log entry (AC 11)
          const auditContext = createAuditContext(headers);
          await tx.insert(auditLogs).values({
            tenantId,
            userId,
            targetUserId: null,
            action: AuditAction.WORKFLOW_INITIATED,
            details: {
              workflowId: workflow.id,
              supplierId: body.supplierId,
              supplierName: supplier.name,
              riskScore,
              riskAssessment: body.riskAssessment,
              checklistId: body.checklistId,
              checklistName: checklist.templateName,
              notes: body.notes || null,
            },
            ipAddress: auditContext.ipAddress,
            userAgent: auditContext.userAgent,
            createdAt: new Date(),
          });

          return workflow;
        });

        set.status = 201;
        return {
          success: true,
          data: {
            workflow: newWorkflow,
          },
        };
      } catch (error: unknown) {
        console.error("Error initiating workflow:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to initiate qualification workflow",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      body: t.Object({
        supplierId: t.String({ format: "uuid" }),
        checklistId: t.String({ format: "uuid" }),
        riskAssessment: t.Object({
          geographic: t.Union([
            t.Literal("low"),
            t.Literal("medium"),
            t.Literal("high"),
          ]),
          financial: t.Union([
            t.Literal("low"),
            t.Literal("medium"),
            t.Literal("high"),
          ]),
          quality: t.Union([
            t.Literal("low"),
            t.Literal("medium"),
            t.Literal("high"),
          ]),
          delivery: t.Union([
            t.Literal("low"),
            t.Literal("medium"),
            t.Literal("high"),
          ]),
        }),
        notes: t.Optional(t.String()),
      }),
      detail: {
        summary: "Initiate qualification workflow",
        description:
          "Initiates a qualification workflow for a supplier (Procurement Manager/Admin only)",
        tags: ["Workflows"],
      },
    }
  );
