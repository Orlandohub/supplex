import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentChecklists, qualificationWorkflows } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * DELETE /api/checklists/:id
 * Soft delete a document checklist template
 *
 * Auth: Requires Admin role
 * Tenant Scoping: Ensures checklist belongs to user's tenant
 * Validation: Cannot delete if template is in use by active workflows
 */
export const deleteChecklistRoute = new Elysia({ prefix: "/checklists" })
  .use(authenticate)
  .delete(
    "/:id",
    async ({ params, user, set }: any) => {
      // Check Admin role
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied. Required role: Admin",
            timestamp: new Date().toISOString(),
          },
        };
      }

      try {
        const tenantId = user.tenantId as string;
        const { id } = params;

        // Verify checklist exists and belongs to tenant
        const existing = await db
          .select()
          .from(documentChecklists)
          .where(
            and(
              eq(documentChecklists.id, id),
              eq(documentChecklists.tenantId, tenantId),
              isNull(documentChecklists.deletedAt)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Checklist not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Check if checklist is in use by active workflows
        const workflowsUsingChecklist = await db
          .select()
          .from(qualificationWorkflows)
          .where(eq(qualificationWorkflows.checklistId, id))
          .limit(1);

        if (workflowsUsingChecklist.length > 0) {
          set.status = 409;
          return {
            success: false,
            error: {
              code: "CONFLICT",
              message: "Cannot delete template in use by active workflows",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Soft delete the checklist
        await db
          .update(documentChecklists)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(documentChecklists.id, id),
              eq(documentChecklists.tenantId, tenantId)
            )
          );

        set.status = 204;
        return;
      } catch (error: any) {
        console.error("Error deleting checklist:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete checklist",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Delete checklist template",
        description:
          "Soft deletes a checklist template (Admin only, not allowed if in use)",
        tags: ["Checklists"],
      },
    }
  );
