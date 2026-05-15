import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  formSection,
  formTemplateVersion,
  insertFormTemplateAuditEvent,
  snapshotRow,
  snapshotsDifferOnTrackedKeys,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";

const SECTION_TRACKED_KEYS = ["title", "description", "sectionOrder"] as const;

/**
 * PATCH /api/form-templates/sections/:sectionId
 * Update a section (Admin only)
 *
 * Auth: Requires Admin role
 * Tenant: Enforces tenant isolation
 * Validation: Parent template must be in 'draft' status
 * Returns: Updated section
 */
export const updateSectionRoute = new Elysia()
  .use(authenticatedRoute)
  .use(requireAdmin)
  .patch(
    "/sections/:sectionId",
    async ({ params, body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { sectionId } = params;

        const updatedSection = await db.transaction(async (tx) => {
          const [section] = await tx
            .select({
              section: formSection,
              versionNumber: formTemplateVersion.versionNumber,
            })
            .from(formSection)
            .innerJoin(
              formTemplateVersion,
              and(
                eq(formSection.formTemplateVersionId, formTemplateVersion.id),
                eq(formTemplateVersion.tenantId, tenantId)
              )
            )
            .where(
              and(
                eq(formSection.id, sectionId),
                eq(formSection.tenantId, tenantId),
                isNull(formSection.deletedAt)
              )
            )
            .limit(1);

          if (!section) {
            throw Errors.notFound(
              "Section not found or you don't have access to it",
              "SECTION_NOT_FOUND"
            );
          }

          if (section.versionNumber !== null) {
            throw Errors.badRequest(
              "Cannot modify section in an immutable published version snapshot.",
              "IMMUTABLE_FORM_VERSION"
            );
          }

          const beforeRow = section.section;

          const updateData: Partial<typeof formSection.$inferInsert> = {
            updatedAt: new Date(),
          };

          if (body.title !== undefined) {
            updateData.title = body.title;
          }

          if (body.description !== undefined) {
            updateData.description = body.description || null;
          }

          if (body.sectionOrder !== undefined) {
            updateData.sectionOrder = body.sectionOrder;
          }

          const [afterRow] = await tx
            .update(formSection)
            .set(updateData)
            .where(eq(formSection.id, sectionId))
            .returning();

          if (!afterRow) {
            throw Errors.internal("Failed to update section");
          }

          const beforeSnap = snapshotRow(beforeRow);
          const afterSnap = snapshotRow(afterRow);

          if (
            snapshotsDifferOnTrackedKeys(
              beforeSnap,
              afterSnap,
              SECTION_TRACKED_KEYS
            )
          ) {
            await insertFormTemplateAuditEvent(tx, {
              tenantId,
              formTemplateId: beforeRow.formTemplateId,
              formTemplateVersionId: beforeRow.formTemplateVersionId,
              actorUserId: user.id,
              eventType: FormTemplateAuditEventType.SECTION_UPDATED,
              subjectType: FormTemplateAuditSubject.SECTION,
              subjectId: beforeRow.id,
              before: beforeSnap,
              after: afterSnap,
              summary: `Section "${afterRow.title}" updated`,
            });
          }

          return afterRow;
        });

        return {
          success: true,
          data: {
            section: updatedSection,
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error updating section");
        throw Errors.internal("Failed to update section");
      }
    },
    {
      params: t.Object({
        sectionId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        description: t.Optional(t.String()),
        sectionOrder: t.Optional(t.Integer({ minimum: 1 })),
      }),
      detail: {
        summary: "Update section",
        description:
          "Updates a section in a draft form template version (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );
