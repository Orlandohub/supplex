import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formSubmission,
  formTemplate,
  processInstance,
  stepInstance,
} from "@supplex/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requireRole } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { Errors } from "../../lib/errors";

/**
 * GET /api/form-submissions/by-supplier/:supplierId
 * List all form submissions linked to a supplier's workflow processes
 *
 * Auth: Requires admin, procurement_manager, or quality_manager role
 * Tenant: Enforces tenant isolation
 * Returns: Array of submissions with template name, workflow name, step name
 */
export const bySupplierRoute = new Elysia()
  .use(authenticatedRoute)
  .use(
    requireRole([
      UserRole.ADMIN,
      UserRole.PROCUREMENT_MANAGER,
      UserRole.QUALITY_MANAGER,
    ])
  )
  .get(
    "/by-supplier/:supplierId",
    async ({ params, user, set, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const { supplierId } = params;

        const submissions = await db
          .select({
            id: formSubmission.id,
            status: formSubmission.status,
            submittedAt: formSubmission.submittedAt,
            createdAt: formSubmission.createdAt,
            formTemplateName: formTemplate.name,
            processInstanceId: formSubmission.processInstanceId,
            workflowName: processInstance.workflowName,
            stepName: stepInstance.stepName,
          })
          .from(formSubmission)
          .innerJoin(
            formTemplate,
            eq(formSubmission.formTemplateId, formTemplate.id)
          )
          .innerJoin(
            processInstance,
            eq(formSubmission.processInstanceId, processInstance.id)
          )
          .innerJoin(
            stepInstance,
            eq(formSubmission.stepInstanceId, stepInstance.id)
          )
          .where(
            and(
              eq(formSubmission.tenantId, tenantId),
              eq(processInstance.entityType, "supplier"),
              eq(processInstance.entityId, supplierId),
              eq(processInstance.tenantId, tenantId),
              eq(formSubmission.status, "submitted"),
              inArray(stepInstance.status, ["completed", "validated"]),
              isNull(formSubmission.deletedAt)
            )
          )
          .orderBy(formSubmission.createdAt);

        set.status = 200;
        return {
          success: true,
          data: {
            submissions: submissions.map((s) => ({
              id: s.id,
              status: s.status,
              submittedAt: s.submittedAt,
              createdAt: s.createdAt,
              formTemplateName: s.formTemplateName,
              workflowName: s.workflowName || "Workflow",
              stepName: s.stepName,
              processInstanceId: s.processInstanceId,
            })),
          },
        };
      } catch (error: any) {
        requestLogger.error(
          { err: error },
          "Supplier form submission list failed"
        );
        throw Errors.internal("Failed to list supplier form submissions");
      }
    },
    {
      params: t.Object({
        supplierId: t.String({ format: "uuid" }),
      }),
    }
  );
