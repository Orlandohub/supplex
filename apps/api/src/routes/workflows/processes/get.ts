/**
 * Process Instance Query API Route
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * GET /api/workflows/processes/:processInstanceId
 * 
 * Returns full workflow state with tenant filtering
 */

import { Elysia, t } from "elysia";
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
} from "@supplex/db";
import { isNull, asc, eq, and, aliasedTable } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";

export const getProcessRoute = new Elysia()
  .use(authenticate)
  .get(
    "/processes/:processInstanceId",
    async ({ params, user }) => {
      const { processInstanceId } = params;

      if (!user?.id || !user?.tenantId) {
        return {
          success: false,
          error: "Unauthorized",
        };
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
          return {
            success: false,
            error: "Process instance not found",
          };
        }

        // Query all step instances (ordered by step_order, with completedBy user name)
        const stepsRaw = await db
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
          .orderBy(stepInstance.stepOrder);

        const steps = stepsRaw.map((row) => ({
          ...row.step,
          completedByFullName: row.completedByFullName,
        }));

        // Query ALL tasks for this process (including validation tasks)
        const completedByUser = aliasedTable(users, "completed_by_user");
        const tasks = await db
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
          .leftJoin(
            users,
            eq(taskInstance.assigneeUserId, users.id)
          )
          .leftJoin(
            completedByUser,
            eq(taskInstance.completedBy, completedByUser.id)
          )
          .where(
            and(
              eq(taskInstance.tenantId, user.tenantId),
              eq(taskInstance.processInstanceId, processInstanceId)
            )
          );

        // Query step templates to get requiresValidation info
        const workflowTemplateId = (process.metadata as any)?.workflowTemplateId;
        let stepTemplates: { stepOrder: number; requiresValidation: boolean; validationConfig: any }[] = [];
        if (workflowTemplateId) {
          stepTemplates = await db
            .select({
              stepOrder: workflowStepTemplate.stepOrder,
              requiresValidation: workflowStepTemplate.requiresValidation,
              validationConfig: workflowStepTemplate.validationConfig,
            })
            .from(workflowStepTemplate)
            .where(
              and(
                eq(workflowStepTemplate.workflowTemplateId, workflowTemplateId),
                eq(workflowStepTemplate.tenantId, user.tenantId),
                isNull(workflowStepTemplate.deletedAt)
              )
            )
            .orderBy(asc(workflowStepTemplate.stepOrder));
        }

        const stepTemplateMap = new Map(
          stepTemplates.map((t) => [t.stepOrder, t])
        );

        // Enrich steps with validation info from templates
        const enrichedSteps = steps.map((s) => {
          const tmpl = stepTemplateMap.get(s.stepOrder);
          const meta = (s.metadata as any) || {};
          return {
            ...s,
            requiresValidation:
              tmpl?.requiresValidation ?? meta.requiresValidation ?? false,
            validationConfig:
              tmpl?.validationConfig ?? meta.validationConfig ?? {},
          };
        });

        // Query comments for this process (with commenter name)
        const comments = await db
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
          .orderBy(commentThread.createdAt);

        // Query form submissions linked to this process (keyed by stepInstanceId)
        const formSubmissions = await db
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
          );

        const formSubmissionsByStep: Record<string, any> = {};
        for (const fs of formSubmissions) {
          if (fs.stepInstanceId) {
            formSubmissionsByStep[fs.stepInstanceId] = fs;
          }
        }

        // Query workflow step documents for document progress
        const stepDocuments = await db
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
          );

        const documentProgressByStep: Record<string, {
          total: number;
          uploaded: number;
          approved: number;
          declined: number;
          pending: number;
          documents: Array<{ requiredDocumentName: string; status: string; declineComment: string | null }>;
        }> = {};
        for (const doc of stepDocuments) {
          if (!documentProgressByStep[doc.stepInstanceId]) {
            documentProgressByStep[doc.stepInstanceId] = { total: 0, uploaded: 0, approved: 0, declined: 0, pending: 0, documents: [] };
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

        return {
          success: true,
          data: {
            process,
            steps: enrichedSteps,
            tasks,
            comments,
            formSubmissions: formSubmissionsByStep,
            documentProgress: documentProgressByStep,
          },
        };
      } catch (error) {
        console.error("Error fetching process:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch process",
        };
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

