import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  formSection,
  formTemplate,
  getDraftFormTemplateVersionForTemplate,
  insertFormTemplateAuditEvent,
  snapshotRow,
  snapshotsDifferOnTrackedKeys,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
} from "@supplex/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

/**
 * POST /api/form-templates/:templateId/sections/reorder
 * Reorder sections within a form template (Admin only)
 */
export const reorderSectionsRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .post(
    "/:templateId/sections/reorder",
    async ({ params, body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { templateId } = params;
        const { sectionIds } = body;

        const template = await db.query.formTemplate.findFirst({
          where: and(
            eq(formTemplate.id, templateId),
            eq(formTemplate.tenantId, tenantId),
            isNull(formTemplate.deletedAt)
          ),
        });

        if (!template) {
          throw Errors.notFound(
            "Form template not found or you don't have access to it",
            "TEMPLATE_NOT_FOUND"
          );
        }

        const draftVersion = await getDraftFormTemplateVersionForTemplate(db, {
          formTemplateId: templateId,
          tenantId,
        });

        if (!draftVersion) {
          throw Errors.badRequest(
            "Cannot reorder sections without an active draft structure",
            "NO_DRAFT_STRUCTURE"
          );
        }

        if (template.status === "archived") {
          throw Errors.badRequest(
            "Cannot reorder sections in an archived template",
            "TEMPLATE_ARCHIVED"
          );
        }

        const sections = await db
          .select()
          .from(formSection)
          .where(
            and(
              eq(formSection.formTemplateVersionId, draftVersion.id),
              eq(formSection.tenantId, tenantId),
              inArray(formSection.id, sectionIds),
              isNull(formSection.deletedAt)
            )
          );

        if (sections.length !== sectionIds.length) {
          throw Errors.badRequest(
            "Some section IDs are invalid or don't belong to the draft structure",
            "INVALID_SECTION_IDS"
          );
        }

        await db.transaction(async (tx) => {
          for (const [i, sectionId] of sectionIds.entries()) {
            const newOrder = i + 1;
            const [beforeRow] = await tx
              .select()
              .from(formSection)
              .where(
                and(
                  eq(formSection.id, sectionId),
                  eq(formSection.tenantId, tenantId),
                  isNull(formSection.deletedAt)
                )
              )
              .limit(1);

            if (!beforeRow) {
              throw Errors.internal("Section missing during reorder");
            }
            if (beforeRow.sectionOrder === newOrder) continue;

            const [afterRow] = await tx
              .update(formSection)
              .set({
                sectionOrder: newOrder,
                updatedAt: new Date(),
              })
              .where(eq(formSection.id, sectionId))
              .returning();

            if (!afterRow) continue;

            const beforeSnap = snapshotRow(beforeRow);
            const afterSnap = snapshotRow(afterRow);

            if (
              snapshotsDifferOnTrackedKeys(beforeSnap, afterSnap, [
                "sectionOrder",
              ])
            ) {
              await insertFormTemplateAuditEvent(tx, {
                tenantId,
                formTemplateId: templateId,
                formTemplateVersionId: beforeRow.formTemplateVersionId,
                actorUserId: user.id,
                eventType: FormTemplateAuditEventType.SECTION_UPDATED,
                subjectType: FormTemplateAuditSubject.SECTION,
                subjectId: beforeRow.id,
                before: beforeSnap,
                after: afterSnap,
                summary: `Section "${afterRow.title}" reordered`,
              });
            }
          }
        });

        return {
          success: true,
          data: {
            message: "Sections reordered successfully",
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error reordering sections");
        throw Errors.internal("Failed to reorder sections");
      }
    },
    {
      params: t.Object({
        templateId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        sectionIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
      }),
      detail: {
        summary: "Reorder sections",
        description: "Reorders sections in a draft form template (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );
