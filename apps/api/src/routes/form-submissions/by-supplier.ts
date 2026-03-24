import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  formSubmission,
  formTemplate,
  processInstance,
  stepInstance,
} from "@supplex/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/form-submissions/by-supplier/:supplierId
 * List all form submissions linked to a supplier's workflow processes
 *
 * Auth: Requires authenticated user (admin/procurement roles)
 * Tenant: Enforces tenant isolation
 * Returns: Array of submissions with template name, workflow name, step name
 */
export const bySupplierRoute = new Elysia().use(authenticate).get(
  "/by-supplier/:supplierId",
  async ({ params, user, set }: any) => {
    try {
      const tenantId = user.tenantId as string;
      const { supplierId } = params;

      const submissions = await db
        .select({
          id: formSubmission.id,
          status: formSubmission.status,
          submittedAt: formSubmission.submittedAt,
          createdAt: formSubmission.createdAt,
          formTemplateName: formTemplate.name,
          processInstanceId: formSubmission.processInstanceId,
          processMetadata: processInstance.metadata,
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
            workflowName:
              (s.processMetadata as any)?.workflowName || "Workflow",
            stepName: s.stepName,
            processInstanceId: s.processInstanceId,
          })),
        },
      };
    } catch (error: any) {
      console.error("Error listing supplier form submissions:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list supplier form submissions",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    params: t.Object({
      supplierId: t.String({ format: "uuid" }),
    }),
  }
);
