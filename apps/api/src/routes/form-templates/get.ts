import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formTemplate,
  formSection,
  formField,
} from "@supplex/db";
import { eq, and, isNull, asc } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/form-templates/:id
 * Get a single form template with all sections and fields
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation - returns 403 for cross-tenant access
 * Returns: Complete template structure with nested sections and fields
 */
export const getFormTemplateRoute = new Elysia()
  .use(authenticate)
  .get(
    "/:id",
    async ({ params, user, set }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const templateId = params.id;

        // Fetch template with tenant isolation
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "TEMPLATE_NOT_FOUND",
              message: "Form template not found or you don't have access to it",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Fetch all sections for this template
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

        // Fetch all fields for all sections
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

        // Build nested structure
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
        console.error("Error fetching form template:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch form template",
            timestamp: new Date().toISOString(),
          },
        };
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

