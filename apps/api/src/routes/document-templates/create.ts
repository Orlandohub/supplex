import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { ApiError, Errors } from "../../lib/errors";

/**
 * POST /api/document-templates
 * Create a new document template
 *
 * Auth: Admin only
 * Body: templateName, requiredDocuments, isDefault, status (optional)
 * Returns: Created template
 */
export const createDocumentTemplateRoute = new Elysia().use(requireAdmin).post(
  "/",
  async ({ body, user, requestLogger }: any) => {
    try {
      const tenantId = user.tenantId as string;

      // If isDefault is true, unset other default templates for this tenant
      if (body.isDefault) {
        await db
          .update(documentTemplate)
          .set({ isDefault: false })
          .where(
            and(
              eq(documentTemplate.tenantId, tenantId),
              eq(documentTemplate.isDefault, true),
              isNull(documentTemplate.deletedAt)
            )
          );
      }

      // Create new template
      const [newTemplate] = await db
        .insert(documentTemplate)
        .values({
          tenantId,
          templateName: body.templateName,
          requiredDocuments: body.requiredDocuments,
          isDefault: body.isDefault,
          status: body.status || "published",
        })
        .returning();

      return {
        success: true,
        data: newTemplate,
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Document template creation failed");
      throw Errors.internal("Failed to create document template");
    }
  },
  {
    body: t.Object({
      templateName: t.String({ maxLength: 200, minLength: 1 }),
      requiredDocuments: t.Array(
        t.Object({
          name: t.String(),
          description: t.String(),
          required: t.Boolean(),
          type: t.Union([
            t.Literal("certification"),
            t.Literal("tax"),
            t.Literal("financial"),
            t.Literal("legal"),
            t.Literal("other"),
          ]),
        })
      ),
      isDefault: t.Boolean(),
      status: t.Optional(
        t.Union([
          t.Literal("draft"),
          t.Literal("published"),
          t.Literal("archived"),
        ])
      ),
    }),
    detail: {
      summary: "Create document template",
      description: "Create a new document template (admin only)",
      tags: ["Document Templates"],
    },
  }
);
