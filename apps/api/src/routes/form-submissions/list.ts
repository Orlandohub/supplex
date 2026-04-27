import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { formSubmission, formTemplate } from "@supplex/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { Errors } from "../../lib/errors";

/**
 * GET /api/form-submissions
 * List user's form submissions
 *
 * Auth: Requires authenticated user
 * Tenant: Enforces tenant isolation
 * Query Parameters:
 * - status: filter by submission status (draft|submitted)
 * - processInstanceId: filter by workflow process instance
 * - stepInstanceId: filter by workflow step instance
 * Returns: Array of submissions with metadata (no answers for performance)
 */
export const listSubmissionsRoute = new Elysia().use(authenticatedRoute).get(
  "/",
  async ({ query, user, set, requestLogger }) => {
    try {
      const tenantId = user.tenantId;
      const userId = user.id;
      const { status, processInstanceId, stepInstanceId } = query;

      // Build query conditions
      const conditions = [
        eq(formSubmission.tenantId, tenantId),
        eq(formSubmission.submittedBy, userId),
        isNull(formSubmission.deletedAt),
      ];

      // Add status filter if provided
      if (status) {
        conditions.push(eq(formSubmission.status, status));
      }

      // Add processInstanceId filter if provided
      if (processInstanceId) {
        conditions.push(
          eq(formSubmission.processInstanceId, processInstanceId)
        );
      }

      // Add stepInstanceId filter if provided
      if (stepInstanceId) {
        conditions.push(eq(formSubmission.stepInstanceId, stepInstanceId));
      }

      // Fetch submissions with template metadata
      const submissions = await db
        .select({
          submission: formSubmission,
          template: {
            id: formTemplate.id,
            name: formTemplate.name,
            status: formTemplate.status,
          },
        })
        .from(formSubmission)
        .innerJoin(
          formTemplate,
          eq(formSubmission.formTemplateId, formTemplate.id)
        )
        .where(and(...conditions))
        .orderBy(desc(formSubmission.updatedAt));

      set.status = 200;
      return {
        success: true,
        data: {
          submissions: submissions.map((row) => ({
            ...row.submission,
            formTemplate: row.template,
          })),
        },
      };
    } catch (error: unknown) {
      requestLogger.error({ err: error }, "Submission list failed");
      throw Errors.internal("Failed to list submissions");
    }
  },
  {
    query: t.Object({
      status: t.Optional(
        t.Union([
          t.Literal("draft"),
          t.Literal("submitted"),
          t.Literal("archived"),
        ])
      ),
      processInstanceId: t.Optional(t.String({ format: "uuid" })),
      stepInstanceId: t.Optional(t.String({ format: "uuid" })),
    }),
  }
);
