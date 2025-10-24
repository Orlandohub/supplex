import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentChecklists } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * PUT /api/checklists/:id
 * Update a document checklist template
 *
 * Auth: Requires Admin role
 * Tenant Scoping: Ensures checklist belongs to user's tenant
 */
export const updateChecklistRoute = new Elysia({ prefix: "/checklists" })
  .use(authenticate)
  .put(
    "/:id",
    async ({ params, body, user, set }: any) => {
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

        // If isDefault=true, unset other defaults first
        if (body.isDefault === true) {
          await db
            .update(documentChecklists)
            .set({ isDefault: false })
            .where(
              and(
                eq(documentChecklists.tenantId, tenantId),
                eq(documentChecklists.isDefault, true)
              )
            );
        }

        // Update checklist
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (body.templateName !== undefined) {
          updateData.templateName = body.templateName;
        }
        if (body.requiredDocuments !== undefined) {
          updateData.requiredDocuments = body.requiredDocuments;
        }
        if (body.isDefault !== undefined) {
          updateData.isDefault = body.isDefault;
        }

        const updatedChecklist = await db
          .update(documentChecklists)
          .set(updateData)
          .where(
            and(
              eq(documentChecklists.id, id),
              eq(documentChecklists.tenantId, tenantId)
            )
          )
          .returning();

        return {
          success: true,
          data: {
            checklist: updatedChecklist[0],
          },
        };
      } catch (error: any) {
        console.error("Error updating checklist:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update checklist",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        templateName: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        requiredDocuments: t.Optional(
          t.Array(
            t.Object({
              name: t.String({ minLength: 1 }),
              description: t.String(),
              required: t.Boolean(),
              type: t.String(),
            })
          )
        ),
        isDefault: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Update checklist template",
        description: "Updates an existing checklist template (Admin only)",
        tags: ["Checklists"],
      },
    }
  );
