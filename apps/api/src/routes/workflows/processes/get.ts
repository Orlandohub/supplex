/**
 * Process Instance Query API Route
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * GET /api/workflows/processes/:processInstanceId
 *
 * Returns full workflow state with tenant filtering
 */

import { Elysia, t } from "elysia";
import { ApiError, Errors } from "../../../lib/errors";
import { db } from "../../../lib/db";
import {
  processInstance,
  stepInstance,
  taskInstance,
  commentThread,
  users,
  workflowStepTemplate,
  formSubmission,
  workflowStepDocument,
  suppliers,
} from "@supplex/db";
import { isNull, asc, eq, and, aliasedTable } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { verifyProcessAccess } from "../../../lib/rbac/entity-authorization";

export const getProcessRoute = new Elysia().use(authenticate).get(
  "/processes/:processInstanceId",
  async ({ params, user, requestLogger }: any) => {
    const { processInstanceId } = params;

    if (!user?.id || !user?.tenantId) {
      throw Errors.unauthorized("Unauthorized");
    }

    try {
      // Query process instance (with tenant filter)
      const [process] = await db
        .select()
        .from(processInstance)
        .where(
          and(
            eq(processInstance.id, processInstanceId),
            eq(processInstance.tenantId, user.tenantId)
          )
        );

      if (!process) {
        throw Errors.notFound("Process instance not found");
      }

      // Entity-level authorization: supplier_user can only access their own processes
      const access = await verifyProcessAccess(user, process, db);
      if (!access.allowed) {
        throw Errors.forbidden(access.reason || "Access denied");
      }

      const isSupplierUser = user.role === UserRole.SUPPLIER_USER;
      const workflowTemplateId = process.workflowTemplateId;
      const completedByUser = aliasedTable(users, "completed_by_user");

      const [
        stepsRaw,
        tasks,
        stepTemplates,
        comments,
        formSubmissions,
        stepDocuments,
        supplierResult,
      ] = await Promise.all([
        db
          .select({
            step: stepInstance,
            completedByFullName: users.fullName,
          })
          .from(stepInstance)
          .leftJoin(users, eq(stepInstance.completedBy, users.id))
          .where(
            and(
              eq(stepInstance.processInstanceId, processInstanceId),
              eq(stepInstance.tenantId, user.tenantId)
            )
          )
          .orderBy(stepInstance.stepOrder),

        db
          .select({
            id: taskInstance.id,
            tenantId: taskInstance.tenantId,
            processInstanceId: taskInstance.processInstanceId,
            stepInstanceId: taskInstance.stepInstanceId,
            title: taskInstance.title,
            description: taskInstance.description,
            assigneeType: taskInstance.assigneeType,
            assigneeRole: taskInstance.assigneeRole,
            assigneeUserId: taskInstance.assigneeUserId,
            completedBy: taskInstance.completedBy,
            status: taskInstance.status,
            dueAt: taskInstance.dueAt,
            taskType: taskInstance.taskType,
            outcome: taskInstance.outcome,
            metadata: taskInstance.metadata,
            createdAt: taskInstance.createdAt,
            updatedAt: taskInstance.updatedAt,
            completedAt: taskInstance.completedAt,
            assignedUserFullName: users.fullName,
            assignedUserEmail: users.email,
            assignedUserRole: users.role,
            completedByFullName: completedByUser.fullName,
          })
          .from(taskInstance)
          .leftJoin(users, eq(taskInstance.assigneeUserId, users.id))
          .leftJoin(
            completedByUser,
            eq(taskInstance.completedBy, completedByUser.id)
          )
          .where(
            and(
              eq(taskInstance.tenantId, user.tenantId),
              eq(taskInstance.processInstanceId, processInstanceId)
            )
          ),

        workflowTemplateId
          ? db
              .select({
                stepOrder: workflowStepTemplate.stepOrder,
                requiresValidation: workflowStepTemplate.requiresValidation,
                validationConfig: workflowStepTemplate.validationConfig,
              })
              .from(workflowStepTemplate)
              .where(
                and(
                  eq(
                    workflowStepTemplate.workflowTemplateId,
                    workflowTemplateId
                  ),
                  eq(workflowStepTemplate.tenantId, user.tenantId),
                  isNull(workflowStepTemplate.deletedAt)
                )
              )
              .orderBy(asc(workflowStepTemplate.stepOrder))
          : Promise.resolve(
              [] as {
                stepOrder: number;
                requiresValidation: boolean;
                validationConfig: any;
              }[]
            ),

        db
          .select({
            id: commentThread.id,
            tenantId: commentThread.tenantId,
            processInstanceId: commentThread.processInstanceId,
            stepInstanceId: commentThread.stepInstanceId,
            entityType: commentThread.entityType,
            entityId: commentThread.entityId,
            parentCommentId: commentThread.parentCommentId,
            commentText: commentThread.commentText,
            commentedBy: commentThread.commentedBy,
            createdAt: commentThread.createdAt,
            updatedAt: commentThread.updatedAt,
            commenterFullName: users.fullName,
            commenterEmail: users.email,
          })
          .from(commentThread)
          .leftJoin(users, eq(commentThread.commentedBy, users.id))
          .where(
            and(
              eq(commentThread.processInstanceId, processInstanceId),
              eq(commentThread.tenantId, user.tenantId)
            )
          )
          .orderBy(commentThread.createdAt),

        db
          .select({
            id: formSubmission.id,
            formTemplateId: formSubmission.formTemplateId,
            stepInstanceId: formSubmission.stepInstanceId,
            status: formSubmission.status,
            submittedBy: formSubmission.submittedBy,
            createdAt: formSubmission.createdAt,
            updatedAt: formSubmission.updatedAt,
          })
          .from(formSubmission)
          .where(
            and(
              eq(formSubmission.processInstanceId, processInstanceId),
              eq(formSubmission.tenantId, user.tenantId),
              isNull(formSubmission.deletedAt)
            )
          ),

        db
          .select({
            id: workflowStepDocument.id,
            stepInstanceId: workflowStepDocument.stepInstanceId,
            requiredDocumentName: workflowStepDocument.requiredDocumentName,
            documentId: workflowStepDocument.documentId,
            status: workflowStepDocument.status,
            declineComment: workflowStepDocument.declineComment,
          })
          .from(workflowStepDocument)
          .where(
            and(
              eq(workflowStepDocument.processInstanceId, processInstanceId),
              eq(workflowStepDocument.tenantId, user.tenantId),
              isNull(workflowStepDocument.deletedAt)
            )
          ),

        process.entityType === "supplier"
          ? db
              .select({ name: suppliers.name })
              .from(suppliers)
              .where(eq(suppliers.id, process.entityId))
          : Promise.resolve([] as { name: string | null }[]),
      ]);

      const steps = stepsRaw.map((row) => ({
        ...row.step,
        completedByFullName: row.completedByFullName,
      }));

      const filteredTasks = isSupplierUser
        ? tasks.filter(
            (t) =>
              t.assigneeUserId === user.id || t.assigneeRole === "supplier_user"
          )
        : tasks;

      const stepTemplateMap = new Map(
        stepTemplates.map((t) => [t.stepOrder, t])
      );

      const enrichedSteps = steps.map((s) => {
        const tmpl = stepTemplateMap.get(s.stepOrder);
        return {
          ...s,
          requiresValidation: tmpl?.requiresValidation ?? false,
          validationConfig: tmpl?.validationConfig ?? {},
        };
      });

      const formSubmissionsByStep: Record<string, any> = {};
      for (const fs of formSubmissions) {
        if (fs.stepInstanceId) {
          formSubmissionsByStep[fs.stepInstanceId] = fs;
        }
      }

      const documentProgressByStep: Record<
        string,
        {
          total: number;
          uploaded: number;
          approved: number;
          declined: number;
          pending: number;
          documents: Array<{
            requiredDocumentName: string;
            status: string;
            declineComment: string | null;
          }>;
        }
      > = {};
      for (const doc of stepDocuments) {
        if (!documentProgressByStep[doc.stepInstanceId]) {
          documentProgressByStep[doc.stepInstanceId] = {
            total: 0,
            uploaded: 0,
            approved: 0,
            declined: 0,
            pending: 0,
            documents: [],
          };
        }
        const p = documentProgressByStep[doc.stepInstanceId];
        p.total++;
        if (doc.status === "uploaded") p.uploaded++;
        else if (doc.status === "approved") p.approved++;
        else if (doc.status === "declined") p.declined++;
        else p.pending++;
        p.documents.push({
          requiredDocumentName: doc.requiredDocumentName,
          status: doc.status || "pending",
          declineComment: doc.declineComment,
        });
      }

      const supplierName = supplierResult[0]?.name ?? null;

      return {
        success: true,
        data: {
          process: { ...process, supplierName },
          steps: enrichedSteps,
          tasks: filteredTasks,
          comments,
          formSubmissions: formSubmissionsByStep,
          documentProgress: documentProgressByStep,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "error fetching process");
      throw Errors.internal("Failed to fetch process");
    }
  },
  {
    params: t.Object({
      processInstanceId: t.String({ format: "uuid" }),
    }),
    detail: {
      summary: "Get Process Instance",
      description:
        "Returns complete workflow state including steps, tasks, and comments",
      tags: ["Workflows"],
    },
  }
);
