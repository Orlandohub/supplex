import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  formSection,
  formTemplate,
  getDraftFormTemplateVersionForTemplate,
  insertFormTemplateAuditEvent,
  snapshotRow,
  allocateSectionKey,
  normalizeClientFormTemplateKeyOrThrow,
  assertSectionKeyAvailable,
  InvalidFormTemplateKeyError,
  FormTemplateAuditEventType,
  FormTemplateAuditSubject,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "../../../lib/rbac/middleware";
import { authenticatedRoute } from "../../../lib/route-plugins";
import { ApiError, Errors } from "../../../lib/errors";
import { isPostgresUniqueViolation } from "../../../lib/pg-errors";

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
        const {
          title,
          description,
          sectionOrder,
          sectionKey,
          slugManuallyEdited,
        } = body;

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

        const newSection = await db.transaction(async (tx) => {
          let resolvedKey: string;
          let manualFlag: boolean;
          if (sectionKey !== undefined && sectionKey.trim() !== "") {
            resolvedKey = normalizeClientFormTemplateKeyOrThrow(sectionKey);
            await assertSectionKeyAvailable(tx, {
              versionId: draftVersion.id,
              tenantId,
              key: resolvedKey,
            });
            manualFlag = true;
          } else {
            resolvedKey = await allocateSectionKey(tx, {
              versionId: draftVersion.id,
              tenantId,
              desiredBase: title,
            });
            manualFlag = slugManuallyEdited ?? false;
          }

          const [row] = await tx
            .insert(formSection)
            .values({
              formTemplateId: templateId,
              formTemplateVersionId: draftVersion.id,
              tenantId,
              title,
              sectionKey: resolvedKey,
              slugManuallyEdited: manualFlag,
              description: description || null,
              sectionOrder,
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          if (!row) {
            throw Errors.internal("Failed to create section");
          }

          await insertFormTemplateAuditEvent(tx, {
            tenantId,
            formTemplateId: templateId,
            formTemplateVersionId: draftVersion.id,
            actorUserId: user.id,
            eventType: FormTemplateAuditEventType.SECTION_CREATED,
            subjectType: FormTemplateAuditSubject.SECTION,
            subjectId: row.id,
            before: null,
            after: snapshotRow(row),
            summary: `Section "${row.title}" created`,
          });

          return row;
        });

        set.status = 201;
        return {
          success: true,
          data: {
            section: newSection,
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
        sectionKey: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
        slugManuallyEdited: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Create section in form template",
        description:
          "Creates a new section in a draft form template (Admin only)",
        tags: ["Form Templates - Sections"],
      },
    }
  );
