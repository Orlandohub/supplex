import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";
import { AuditAction } from "@supplex/types";
import { authCache } from "../../lib/auth-cache";
import { ApiError, Errors } from "../../lib/errors";

/**
 * PATCH /api/users/:id/status
 * Deactivates or reactivates a user (soft delete)
 *
 * Body:
 * - isActive: true to reactivate, false to deactivate
 *
 * Auth: Requires Admin role
 * Business Rules:
 * - Admin cannot deactivate their own account (prevent lockout)
 * - Must be in the same tenant as the target user
 * - Preserves audit history
 */
export const deactivateUserRoute = new Elysia({ prefix: "/users" })
  .use(requireAdmin)
  .patch(
    "/:id/status",
    async ({ params, body, user, set, headers, requestLogger }: any) => {
      try {
        const { id: targetUserId } = params;
        const { isActive } = body;
        const currentUserId = user.id as string;
        const tenantId = user.tenantId as string;
        const auditContext = createAuditContext(
          headers as Record<string, string | undefined>
        );

        // Prevent admin from deactivating their own account
        if (currentUserId === targetUserId && !isActive) {
          throw Errors.forbidden("You cannot deactivate your own account");
        }

        // Step 1: Fetch target user and verify tenant membership
        const [targetUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, targetUserId), eq(users.tenantId, tenantId)))
          .limit(1);

        if (!targetUser) {
          throw Errors.notFound("User not found in your tenant");
        }

        const oldStatus = targetUser.isActive;

        // Step 2: Update user status
        const [updatedUser] = await db
          .update(users)
          .set({
            isActive,
            updatedAt: new Date(),
          })
          .where(eq(users.id, targetUserId))
          .returning();

        if (!updatedUser) {
          throw new Error("Failed to update user status");
        }

        // Step 3: Invalidate auth cache
        // This ensures the user's deactivation takes effect immediately
        // instead of waiting for cache TTL (5 minutes) to expire
        await authCache.invalidate(targetUserId);

        // Log audit event
        const action = isActive
          ? AuditAction.USER_REACTIVATED
          : AuditAction.USER_DEACTIVATED;
        await logAuditEvent({
          tenantId,
          userId: currentUserId,
          targetUserId,
          action,
          details: {
            old_status: oldStatus,
            new_status: isActive,
            target_user_email: updatedUser.email,
          },
          ...auditContext,
        });

        return {
          success: true,
          data: {
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              fullName: updatedUser.fullName,
              role: updatedUser.role,
              tenantId: updatedUser.tenantId,
              isActive: updatedUser.isActive,
            },
          },
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error updating user status");
        throw Errors.internal("Internal server error");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        isActive: t.Boolean(),
      }),
      detail: {
        summary: "Deactivate or reactivate user",
        description:
          "Soft deletes a user by setting isActive to false, or reactivates them",
        tags: ["Users"],
      },
    }
  );
