/**
 * Step Instance Query API Route
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * GET /api/workflows/steps/:stepInstanceId
 *
 * Returns complete step state with tenant filtering
 */

import { Elysia, t } from "elysia";
import { ApiError, Errors } from "../../../lib/errors";
import { db } from "../../../lib/db";
import {
  stepInstance,
  taskInstance,
  commentThread,
  workflowStepTemplate,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { verifyStepProcessAccess } from "../../../lib/rbac/entity-authorization";

export const getStepRoute = new Elysia().use(authenticate).get(
  "/steps/:stepInstanceId",
  async ({ params, user, requestLogger }: any) => {
    const { stepInstanceId } = params;

    if (!user?.id || !user?.tenantId) {
      throw Errors.unauthorized("Unauthorized");
    }

    try {
      // Query step instance (with tenant filter)
      const [step] = await db
        .select()
        .from(stepInstance)
        .where(
          and(
            eq(stepInstance.id, stepInstanceId),
            eq(stepInstance.tenantId, user.tenantId)
          )
        );

      if (!step) {
        throw Errors.notFound("Step instance not found");
      }

      // Entity-level authorization: supplier_user can only access their own processes
      const access = await verifyStepProcessAccess(user, stepInstanceId, db);
      if (!access.allowed) {
        throw Errors.forbidden(access.reason || "Access denied");
      }

      const isSupplierUser = user.role === UserRole.SUPPLIER_USER;

      // Query workflow step template via direct FK
      const stepTemplate = step.workflowStepTemplateId
        ? (
            await db
              .select()
              .from(workflowStepTemplate)
              .where(
                and(
                  eq(workflowStepTemplate.id, step.workflowStepTemplateId),
                  eq(workflowStepTemplate.tenantId, user.tenantId)
                )
              )
          )[0] || null
        : null;

      // Query tasks for this step
      const tasks = await db
        .select()
        .from(taskInstance)
        .where(
          and(
            eq(taskInstance.stepInstanceId, stepInstanceId),
            eq(taskInstance.tenantId, user.tenantId)
          )
        );

      // Query comments for this step
      const comments = await db
        .select()
        .from(commentThread)
        .where(
          and(
            eq(commentThread.stepInstanceId, stepInstanceId),
            eq(commentThread.tenantId, user.tenantId)
          )
        )
        .orderBy(commentThread.createdAt);

      const filteredTasks = isSupplierUser
        ? tasks.filter(
            (t) =>
              t.assigneeUserId === user.id || t.assigneeRole === "supplier_user"
          )
        : tasks;

      return {
        success: true,
        data: {
          step,
          stepTemplate,
          tasks: filteredTasks,
          comments,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "error fetching step");
      throw Errors.internal("Failed to fetch step");
    }
  },
  {
    params: t.Object({
      stepInstanceId: t.String({ format: "uuid" }),
    }),
    detail: {
      summary: "Get Step Instance",
      description:
        "Returns complete step state including configuration, tasks, and comments",
      tags: ["Workflows"],
    },
  }
);
