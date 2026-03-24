import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import { formSection, formTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * POST /api/form-templates/:templateId/sections
 * Create a new section in a form template (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Template must be in 'draft' status (can't modify published templates)
 * Returns: Created section
 */
export const createSectionRoute = new Elysia()
  .use(authenticate)
  .post(
    "/:templateId/sections",
    async ({ params, body, user, set }: any) => {
      // Check role permission - Admin only
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
        const { templateId } = params;
        const { title, description, sectionOrder } = body;

        // Verify template exists, belongs to user's tenant, and is draft
        const [template] = await db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, templateId),
              eq(formTemplate.tenantId, tenantId),
              isNull(formTemplate.deletedAt)
            )
          )
          .limit(1);

        if (!template) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "TEMPLATE_NOT_FOUND",
              message:
                "Form template not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Check if template is draft (can't modify published templates)
        if (template.status !== "draft") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "TEMPLATE_PUBLISHED",
              message:
                "Cannot modify published template. Please copy the template to make changes.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Create section
        const [newSection] = await db
          .insert(formSection)
          .values({
            formTemplateId: templateId,
            tenantId,
            title,
            description: description || null,
            sectionOrder,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        set.status = 201;
        return {
          success: true,
          data: {
            section: newSection,
          },
        };
      } catch (error: any) {
        console.error("Error creating section:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create section",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      params: t.Object({
        templateId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 255 }),
        description: t.Optional(t.String()),
        sectionOrder: t.Integer({ minimum: 1 }),
      }),
      detail: {
        summary: "Create section in form template",
        description:
          "Creates a new section in a draft form template (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );

