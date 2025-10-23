import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";
import { AuditAction } from "@supplex/types";

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
    async ({ params, body, user, set, headers }: any) => {
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
          set.status = 403;
          return {
            success: false,
            error: "You cannot deactivate your own account",
          };
        }

        // Step 1: Fetch target user and verify tenant membership
        const [targetUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, targetUserId), eq(users.tenantId, tenantId)))
          .limit(1);

        if (!targetUser) {
          set.status = 404;
          return {
            success: false,
            error: "User not found in your tenant",
          };
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
        console.error("Error updating user status:", error);
        set.status = 500;
        return {
          success: false,
          error: "Internal server error",
        };
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
