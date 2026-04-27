import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { userNotificationPreferences } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { EmailEventType } from "@supplex/types";
import { Errors } from "../../lib/errors";

/**
 * GET /api/users/me/notification-preferences
 * Get authenticated user's email notification preferences
 *
 * Auth: Requires authentication
 */
export const getNotificationPreferencesRoute = new Elysia({ prefix: "/users" })
  .use(authenticatedRoute)
  .get(
    "/me/notification-preferences",
    async ({ user, requestLogger }) => {
      try {
        const userId = user.id;
        const tenantId = user.tenantId;

        // Fetch user preferences
        const preferences = await db
          .select()
          .from(userNotificationPreferences)
          .where(
            and(
              eq(userNotificationPreferences.userId, userId),
              eq(userNotificationPreferences.tenantId, tenantId)
            )
          );

        // Convert to map for easy lookup
        const preferencesMap: Record<string, boolean> = {};
        for (const pref of preferences) {
          preferencesMap[pref.eventType] = pref.emailEnabled;
        }

        // Default all to true if not set
        const result = {
          workflowSubmitted:
            preferencesMap[EmailEventType.WORKFLOW_SUBMITTED] ?? true,
          stageApproved: preferencesMap[EmailEventType.STAGE_APPROVED] ?? true,
          stageRejected: preferencesMap[EmailEventType.STAGE_REJECTED] ?? true,
          stageAdvanced: preferencesMap[EmailEventType.STAGE_ADVANCED] ?? true,
          workflowApproved:
            preferencesMap[EmailEventType.WORKFLOW_APPROVED] ?? true,
        };

        return {
          success: true,
          data: result,
        };
      } catch (error: unknown) {
        requestLogger.error(
          { err: error },
          "Error fetching notification preferences"
        );
        throw Errors.internal("Internal server error");
      }
    },
    {
      detail: {
        summary: "Get user notification preferences",
        description:
          "Retrieve authenticated user's email notification preferences",
        tags: ["Users", "Notifications"],
      },
    }
  );

/**
 * PUT /api/users/me/notification-preferences
 * Update authenticated user's email notification preferences
 *
 * Body:
 * - eventType: Type of notification event
 * - emailEnabled: Whether email is enabled for this event
 *
 * Auth: Requires authentication
 */
export const updateNotificationPreferencesRoute = new Elysia({
  prefix: "/users",
})
  .use(authenticatedRoute)
  .put(
    "/me/notification-preferences",
    async ({ body, user, requestLogger }) => {
      try {
        const userId = user.id;
        const tenantId = user.tenantId;
        const { eventType, emailEnabled } = body;

        // Check if preference already exists
        const existingPref =
          await db.query.userNotificationPreferences.findFirst({
            where: and(
              eq(userNotificationPreferences.userId, userId),
              eq(userNotificationPreferences.eventType, eventType)
            ),
          });

        if (existingPref) {
          // Update existing preference
          const [updated] = await db
            .update(userNotificationPreferences)
            .set({
              emailEnabled,
              unsubscribedAt: emailEnabled ? null : new Date(),
              updatedAt: new Date(),
            })
            .where(eq(userNotificationPreferences.id, existingPref.id))
            .returning();

          if (!updated)
            throw new Error("Failed to update notification preference");

          return {
            success: true,
            data: {
              eventType: updated.eventType,
              emailEnabled: updated.emailEnabled,
            },
            message: "Notification preference updated successfully",
          };
        } else {
          // Create new preference
          const [created] = await db
            .insert(userNotificationPreferences)
            .values({
              userId,
              tenantId,
              eventType,
              emailEnabled,
              unsubscribedAt: emailEnabled ? null : new Date(),
            })
            .returning();

          if (!created)
            throw new Error("Failed to create notification preference");

          return {
            success: true,
            data: {
              eventType: created.eventType,
              emailEnabled: created.emailEnabled,
            },
            message: "Notification preference created successfully",
          };
        }
      } catch (error: unknown) {
        requestLogger.error(
          { err: error },
          "Error updating notification preferences"
        );
        throw Errors.internal("Internal server error");
      }
    },
    {
      body: t.Object({
        eventType: t.Union([
          t.Literal(EmailEventType.WORKFLOW_SUBMITTED),
          t.Literal(EmailEventType.STAGE_APPROVED),
          t.Literal(EmailEventType.STAGE_REJECTED),
          t.Literal(EmailEventType.STAGE_ADVANCED),
          t.Literal(EmailEventType.WORKFLOW_APPROVED),
        ]),
        emailEnabled: t.Boolean(),
      }),
      detail: {
        summary: "Update user notification preference",
        description:
          "Update email notification preference for a specific event type",
        tags: ["Users", "Notifications"],
      },
    }
  );
