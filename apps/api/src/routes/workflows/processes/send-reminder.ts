import { Elysia, t } from "elysia";
import { db } from "../../../lib/db";
import {
  processInstance,
  taskInstance,
  users,
  suppliers,
  emailNotifications,
  EmailNotificationStatus,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../lib/rbac/middleware";
import { UserRole, EmailEventType } from "@supplex/types";
import { queueEmailJob } from "../../../queue/email-queue";

const FRONTEND_URL = globalThis.process?.env?.FRONTEND_URL || "http://localhost:3000";

/**
 * POST /api/workflows/processes/:processInstanceId/send-reminder
 * Send a reminder notification to the supplier-user assignee of the current step.
 *
 * Auth: admin or procurement_manager only
 * Validates: process belongs to tenant, has pending supplier-assigned task
 */
export const sendReminderRoute = new Elysia().use(authenticate).post(
  "/processes/:processInstanceId/send-reminder",
  async ({ user, set, params }) => {
    const tenantId = user!.tenantId as string;
    const userRole = user!.role as string;
    const callerName = user!.fullName as string;

    if (
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.PROCUREMENT_MANAGER
    ) {
      set.status = 403;
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only admin and procurement_manager can send reminders",
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      const processId = params.processInstanceId;

      const workflowProcess = await db.query.processInstance.findFirst({
        where: and(
          eq(processInstance.id, processId),
          eq(processInstance.tenantId, tenantId),
          isNull(processInstance.deletedAt)
        ),
        columns: {
          id: true,
          status: true,
          currentStepInstanceId: true,
          entityType: true,
          entityId: true,
        },
      });

      if (!workflowProcess) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Process not found",
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (
        workflowProcess.status !== "in_progress" &&
        workflowProcess.status !== "pending_validation"
      ) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "INVALID_STATE",
            message:
              "Reminders can only be sent for in-progress or pending-validation workflows",
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (!workflowProcess.currentStepInstanceId) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Process has no active step",
            timestamp: new Date().toISOString(),
          },
        };
      }

      const [supplierTask] = await db
        .select({
          taskId: taskInstance.id,
          title: taskInstance.title,
          assigneeUserId: taskInstance.assigneeUserId,
          assigneeRole: taskInstance.assigneeRole,
        })
        .from(taskInstance)
        .where(
          and(
            eq(taskInstance.stepInstanceId, workflowProcess.currentStepInstanceId),
            eq(taskInstance.status, "pending"),
            eq(taskInstance.assigneeRole, "supplier_user"),
            isNull(taskInstance.deletedAt)
          )
        )
        .limit(1);

      if (!supplierTask) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "NO_SUPPLIER_TASK",
            message:
              "No pending task assigned to a supplier user on the current step",
            timestamp: new Date().toISOString(),
          },
        };
      }

      let recipientEmail: string | null = null;
      let recipientName = "Supplier";

      if (supplierTask.assigneeUserId) {
        const assignee = await db.query.users.findFirst({
          where: eq(users.id, supplierTask.assigneeUserId),
          columns: { email: true, fullName: true },
        });
        if (assignee) {
          recipientEmail = assignee.email;
          recipientName = assignee.fullName || "Supplier";
        }
      }

      if (!recipientEmail && workflowProcess.entityType === "supplier") {
        const supplier = await db.query.suppliers.findFirst({
          where: and(
            eq(suppliers.id, workflowProcess.entityId),
            isNull(suppliers.deletedAt)
          ),
          columns: { contactEmail: true, name: true },
        });
        if (supplier?.contactEmail) {
          recipientEmail = supplier.contactEmail;
          recipientName = supplier.name || "Supplier";
        }
      }

      if (!recipientEmail) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "NO_RECIPIENT",
            message:
              "Could not determine recipient email for the supplier task",
            timestamp: new Date().toISOString(),
          },
        };
      }

      const subject = `Reminder: Action Required - ${supplierTask.title}`;

      const [notification] = await db
        .insert(emailNotifications)
        .values({
          tenantId,
          userId: supplierTask.assigneeUserId || workflowProcess.entityId,
          eventType: EmailEventType.WORKFLOW_SUBMITTED,
          recipientEmail,
          subject,
          status: EmailNotificationStatus.PENDING,
          attemptCount: 0,
        })
        .returning();

      await queueEmailJob({
        notificationId: notification.id,
        recipientEmail,
        recipientName,
        subject,
        templateName: "workflow-reminder",
        templateData: {
          recipientName,
          taskTitle: supplierTask.title,
          senderName: callerName,
          workflowLink: `${FRONTEND_URL}/workflows/processes/${processId}`,
          unsubscribeLink: "#",
        },
      });

      return {
        success: true,
        data: { message: "Reminder sent successfully" },
      };
    } catch (error) {
      console.error("Error sending reminder:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to send reminder",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    params: t.Object({
      processInstanceId: t.String(),
    }),
    detail: {
      summary: "Send reminder to supplier",
      description:
        "Sends a reminder notification to the supplier-user assigned to the current step",
      tags: ["Workflows", "Processes"],
    },
  }
);
