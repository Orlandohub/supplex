import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  formSection,
  formTemplate,
  getDraftFormTemplateVersionForTemplate,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * POST /api/form-templates/:templateId/sections
 * Create a new section in a form template (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Container must not be archived; structure is appended to the mutable draft version.
 * Returns: Created section
 */
export const createSectionRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .post(
    "/:templateId/sections",
    async ({ params, body, user, set, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { templateId } = params;
        const { title, description, sectionOrder } = body;

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
          throw Errors.notFound(
            "Form template not found or you don't have access to it",
            "TEMPLATE_NOT_FOUND"
          );
        }

        if (template.status === "archived") {
          throw Errors.badRequest(
            "Cannot modify archived template.",
            "TEMPLATE_ARCHIVED"
          );
        }

        const draftVersion = await getDraftFormTemplateVersionForTemplate(db, {
          formTemplateId: templateId,
          tenantId,
        });

        if (!draftVersion) {
          throw Errors.badRequest(
            "No draft structure available to add sections to",
            "NO_DRAFT_STRUCTURE"
          );
        }

        const [newSection] = await db
          .insert(formSection)
          .values({
            formTemplateId: templateId,
            formTemplateVersionId: draftVersion.id,
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
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error creating section");
        throw Errors.internal("Failed to create section");
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
