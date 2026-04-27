import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formTemplate, formSection, formField } from "@supplex/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/form-templates/:id
 * Get a single form template with all sections and fields
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation - returns 403 for cross-tenant access
 * Returns: Complete template structure with nested sections and fields
 */
export const getFormTemplateRoute = new Elysia().use(authenticatedRoute).get(
  "/:id",
  async ({ params, user, requestLogger }) => {
    try {
      const tenantId = user.tenantId;
      const templateId = params.id;

      const [templateRecord] = await db
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

      if (!templateRecord) {
        throw Errors.notFound(
          "Form template not found or you don't have access to it",
          "TEMPLATE_NOT_FOUND"
        );
      }

      if (
        user.role !== UserRole.ADMIN &&
        templateRecord.status !== "published"
      ) {
        throw Errors.notFound(
          "Form template not found or you don't have access to it",
          "TEMPLATE_NOT_FOUND"
        );
      }

      const sections = await db
        .select()
        .from(formSection)
        .where(
          and(
            eq(formSection.formTemplateId, templateId),
            eq(formSection.tenantId, tenantId),
            isNull(formSection.deletedAt)
          )
        )
        .orderBy(asc(formSection.sectionOrder));

      const sectionIds = sections.map((s) => s.id);
      const fields =
        sectionIds.length > 0
          ? await db
              .select()
              .from(formField)
              .where(
                and(
                  eq(formField.tenantId, tenantId),
                  isNull(formField.deletedAt)
                )
              )
              .orderBy(asc(formField.fieldOrder))
          : [];

      const sectionsWithFields = sections.map((section) => {
        const sectionFields = fields.filter(
          (f) => f.formSectionId === section.id
        );
        return {
          ...section,
          fields: sectionFields,
        };
      });

      return {
        success: true,
        data: {
          ...templateRecord,
          sections: sectionsWithFields,
        },
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Error fetching form template");
      throw Errors.internal("Failed to fetch form template");
    }
  },
  {
    params: t.Object({
      id: t.String({ format: "uuid" }),
    }),
    detail: {
      summary: "Get form template by ID",
      description:
        "Get complete form template structure with sections and fields",
      tags: ["Form Templates"],
    },
  }
);
