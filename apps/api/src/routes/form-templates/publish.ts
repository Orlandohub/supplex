import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formTemplate,
  formSection,
  formField,
  publishFormTemplateFromDraft,
  getDraftFormTemplateVersionForTemplate,
} from "@supplex/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

function mapPublishDraftError(error: unknown): ApiError | null {
  if (!(error instanceof Error)) return null;
  switch (error.message) {
    case "FORM_TEMPLATE_PUBLISH_NO_SECTIONS":
      return Errors.badRequest(
        "Cannot publish template without sections. Please add at least one section.",
        "VALIDATION_ERROR"
      );
    case "FORM_TEMPLATE_PUBLISH_NO_FIELDS":
      return Errors.badRequest(
        "Cannot publish template without fields. Please add at least one field to a section.",
        "VALIDATION_ERROR"
      );
    case "FORM_TEMPLATE_DRAFT_VERSION_MISSING":
      return Errors.badRequest(
        "No draft form version found to publish",
        "VALIDATION_ERROR"
      );
    case "FORM_TEMPLATE_NOT_FOUND":
      return Errors.notFound(
        "Form template not found or you don't have access to it",
        "TEMPLATE_NOT_FOUND"
      );
    default:
      return null;
  }
}

/**
 * PATCH /api/form-templates/:id/publish
 * Publishing performs copy-on-publish: draft subtree → new immutable published version
 * (new UUIDs), supersede prior head, fresh draft copied from the new published snapshot.
 *
 * Unpublishing only sets the container to `draft`; version history is preserved.
 */
export const publishVersionRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .patch(
    "/:id/publish",
    async ({ params, body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { id } = params;
        const action = body?.action;

        const [template] = await db
          .select()
          .from(formTemplate)
          .where(
            and(
              eq(formTemplate.id, id),
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
            "Archived templates cannot change publish state",
            "TEMPLATE_ARCHIVED"
          );
        }

        if (template.status === "published") {
          if (!action) {
            throw Errors.badRequest(
              'Specify action: "publish" (ship draft changes) or "unpublish" (container only)',
              "PUBLISH_ACTION_REQUIRED"
            );
          }
          if (action === "unpublish") {
            const unf = await db
              .update(formTemplate)
              .set({
                status: "draft",
                updatedAt: new Date(),
              })
              .where(eq(formTemplate.id, id))
              .returning();

            const [updatedTemplate] = unf;
            if (!updatedTemplate) {
              throw Errors.internal("Failed to toggle publish status");
            }

            return {
              success: true,
              data: updatedTemplate,
              message: "Template unpublished successfully",
            };
          }
          if (action !== "publish") {
            throw Errors.badRequest(
              'Invalid action — use "publish" or "unpublish"',
              "VALIDATION_ERROR"
            );
          }
        } else {
          if (action === "unpublish") {
            throw Errors.badRequest(
              "Only published templates can be unpublished",
              "VALIDATION_ERROR"
            );
          }
        }

        const draftVersion = await getDraftFormTemplateVersionForTemplate(db, {
          formTemplateId: id,
          tenantId,
        });

        if (!draftVersion) {
          throw Errors.badRequest(
            "No draft form version found to publish",
            "VALIDATION_ERROR"
          );
        }

        const [sectionCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(formSection)
          .where(
            and(
              eq(formSection.formTemplateId, id),
              eq(formSection.formTemplateVersionId, draftVersion.id),
              eq(formSection.tenantId, tenantId),
              isNull(formSection.deletedAt)
            )
          );

        if (!sectionCount || sectionCount.count === 0) {
          throw Errors.badRequest(
            "Cannot publish template without sections. Please add at least one section.",
            "VALIDATION_ERROR"
          );
        }

        const [fieldCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(formField)
          .innerJoin(formSection, eq(formField.formSectionId, formSection.id))
          .where(
            and(
              eq(formSection.formTemplateId, id),
              eq(formSection.formTemplateVersionId, draftVersion.id),
              eq(formField.formTemplateVersionId, draftVersion.id),
              eq(formField.tenantId, tenantId),
              isNull(formField.deletedAt),
              isNull(formSection.deletedAt)
            )
          );

        if (!fieldCount || fieldCount.count === 0) {
          throw Errors.badRequest(
            "Cannot publish template without fields. Please add at least one field to a section.",
            "VALIDATION_ERROR"
          );
        }

        try {
          const updatedTemplate = await db.transaction(async (tx) => {
            await publishFormTemplateFromDraft(tx, {
              formTemplateId: id,
              tenantId,
              actorUserId: user.id,
            });
            const [tpl] = await tx
              .select()
              .from(formTemplate)
              .where(eq(formTemplate.id, id))
              .limit(1);
            if (!tpl) {
              throw Errors.internal("Failed to load template after publish");
            }
            return tpl;
          });

          return {
            success: true,
            data: updatedTemplate,
            message:
              template.status === "published"
                ? "New template version published successfully"
                : "Template published successfully",
          };
        } catch (inner: unknown) {
          const mapped = mapPublishDraftError(inner);
          if (mapped) throw mapped;
          throw inner;
        }
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error toggling publish status");
        throw Errors.internal("Failed to toggle publish status");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Optional(
        t.Object({
          action: t.Optional(
            t.Union([t.Literal("publish"), t.Literal("unpublish")])
          ),
        })
      ),
      detail: {
        summary: "Publish or unpublish form template",
        description:
          'Draft: publish creates immutable version + fresh draft. Published: body.action "publish" ships draft changes; "unpublish" sets container to draft (Admin only).',
        tags: ["Form Templates"],
      },
    }
  );
