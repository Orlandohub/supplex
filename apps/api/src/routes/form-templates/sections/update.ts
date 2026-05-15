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
  allocateSectionKey,
  normalizeClientFormTemplateKeyOrThrow,
  assertSectionKeyAvailable,
  InvalidFormTemplateKeyError,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";
import { isPostgresUniqueViolation } from "../../../lib/pg-errors";

const SECTION_TRACKED_KEYS = [
  "title",
  "description",
  "sectionOrder",
  "sectionKey",
  "slugManuallyEdited",
] as const;

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
            throw Errors.conflict(
              "Cannot modify section in an immutable published version snapshot.",
              "IMMUTABLE_FORM_VERSION"
            );
          }

          const beforeRow = section.section;

          const updateData: Partial<typeof formSection.$inferInsert> = {
            updatedAt: new Date(),
          };

          let nextSlugManual = beforeRow.slugManuallyEdited;
          if (body.slugManuallyEdited !== undefined) {
            updateData.slugManuallyEdited = body.slugManuallyEdited;
            nextSlugManual = body.slugManuallyEdited;
          }

          if (body.title !== undefined) {
            updateData.title = body.title;
          }

          if (body.description !== undefined) {
            updateData.description = body.description || null;
          }

          if (body.sectionOrder !== undefined) {
            updateData.sectionOrder = body.sectionOrder;
          }

          const effectiveTitle =
            body.title !== undefined ? body.title : beforeRow.title;

          if (body.sectionKey !== undefined && body.sectionKey.trim() !== "") {
            const k = normalizeClientFormTemplateKeyOrThrow(body.sectionKey);
            await assertSectionKeyAvailable(tx, {
              versionId: beforeRow.formTemplateVersionId,
              tenantId,
              key: k,
              excludeSectionId: sectionId,
            });
            updateData.sectionKey = k;
            updateData.slugManuallyEdited = true;
          } else if (
            body.title !== undefined &&
            body.title !== beforeRow.title &&
            !nextSlugManual
          ) {
            updateData.sectionKey = await allocateSectionKey(tx, {
              versionId: beforeRow.formTemplateVersionId,
              tenantId,
              desiredBase: effectiveTitle,
              excludeSectionId: sectionId,
            });
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
        if (error instanceof InvalidFormTemplateKeyError) {
          throw Errors.badRequest(error.message, error.code);
        }
        if (
          error instanceof Error &&
          error.message === "FORM_TEMPLATE_SECTION_KEY_TAKEN"
        ) {
          throw Errors.conflict(
            "That section key is already used in this form version.",
            "DUPLICATE_FORM_KEY"
          );
        }
        if (isPostgresUniqueViolation(error)) {
          throw Errors.conflict(
            "That key is already used in this form version.",
            "DUPLICATE_FORM_KEY"
          );
        }
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
        sectionKey: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
        slugManuallyEdited: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Update section",
        description:
          "Updates a section in a draft form template version (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );
