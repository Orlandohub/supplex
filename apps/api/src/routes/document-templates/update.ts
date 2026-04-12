import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { documentTemplate } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { ApiError, Errors } from "../../lib/errors";

/**
 * PUT /api/document-templates/:id
 * Update an existing document template
 *
 * Auth: Admin only
 * Params: id (UUID)
 * Body: templateName, requiredDocuments, isDefault, status (all optional)
 * Returns: Updated template
 */
export const updateDocumentTemplateRoute = new Elysia()
  .use(requireAdmin)
  .put(
    "/:id",
    async ({ params, body, user, set, requestLogger }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const templateId = params.id;

        // Verify template exists and belongs to tenant
        const [existingTemplate] = await db
          .select()
          .from(documentTemplate)
          .where(
            and(
              eq(documentTemplate.id, templateId),
              eq(documentTemplate.tenantId, tenantId),
              isNull(documentTemplate.deletedAt)
            )
          )
          .limit(1);

        if (!existingTemplate) {
          throw Errors.notFound("Document template not found");
        }

        // If isDefault is being set to true, unset other default templates
        if (body.isDefault === true) {
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

        // Build update object with only provided fields
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
        if (body.status !== undefined) {
          updateData.status = body.status;
        }

        // Update template
        const [updatedTemplate] = await db
          .update(documentTemplate)
          .set(updateData)
          .where(eq(documentTemplate.id, templateId))
          .returning();

        return {
          success: true,
          data: updatedTemplate,
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Document template update failed");
        throw Errors.internal("Failed to update document template");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        templateName: t.Optional(t.String({ maxLength: 200, minLength: 1 })),
        requiredDocuments: t.Optional(
          t.Array(
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
          )
        ),
        isDefault: t.Optional(t.Boolean()),
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("published"),
            t.Literal("archived"),
          ])
        ),
      }),
      detail: {
        summary: "Update document template",
        description: "Update an existing document template (admin only)",
        tags: ["Document Templates"],
      },
    }
  );

