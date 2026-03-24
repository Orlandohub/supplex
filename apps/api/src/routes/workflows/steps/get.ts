/**
 * Step Instance Query API Route
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * GET /api/workflows/steps/:stepInstanceId
 * 
 * Returns complete step state with tenant filtering
 */

import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  stepInstance,
  taskInstance,
  commentThread,
  workflowStepTemplate,
} from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";

export const getStepRoute = new Elysia()
  .use(authenticate)
  .get(
    "/steps/:stepInstanceId",
    async ({ params, user }) => {
      const { stepInstanceId } = params;

      if (!user?.id || !user?.tenantId) {
        return {
          success: false,
          error: "Unauthorized",
        };
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
          return {
            success: false,
            error: "Step instance not found",
          };
        }

        // Query workflow step template configuration (simplified query)
        const stepTemplates = await db
          .select()
          .from(workflowStepTemplate)
          .where(
            and(
              eq(workflowStepTemplate.tenantId, user.tenantId),
              eq(workflowStepTemplate.stepOrder, step.stepOrder)
            )
          );

        const stepTemplate = stepTemplates[0] || null;

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

        return {
          success: true,
          data: {
            step,
            stepTemplate,
            tasks,
            comments,
          },
        };
      } catch (error) {
        console.error("Error fetching step:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch step",
        };
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

