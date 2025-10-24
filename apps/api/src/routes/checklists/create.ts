import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentChecklists } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * POST /api/checklists
 * Create a new document checklist template
 *
 * Auth: Requires Admin role
 * Tenant Scoping: Automatically sets tenant_id from authenticated user's JWT
 */
export const createChecklistRoute = new Elysia({ prefix: "/checklists" })
  .use(authenticate)
  .post(
    "/",
    async ({ body, user, set }: any) => {
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

        // Insert new checklist template
        const newChecklist = await db
          .insert(documentChecklists)
          .values({
            tenantId,
            templateName: body.templateName,
            requiredDocuments: body.requiredDocuments,
            isDefault: body.isDefault ?? false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        set.status = 201;
        return {
          success: true,
          data: {
            checklist: newChecklist[0],
          },
        };
      } catch (error: any) {
        console.error("Error creating checklist:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create checklist",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      body: t.Object({
        templateName: t.String({ minLength: 1, maxLength: 200 }),
        requiredDocuments: t.Array(
          t.Object({
            name: t.String({ minLength: 1 }),
            description: t.String(),
            required: t.Boolean(),
            type: t.String(),
          })
        ),
        isDefault: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Create new checklist template",
        description: "Creates a new document checklist template (Admin only)",
        tags: ["Checklists"],
      },
    }
  );
