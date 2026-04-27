import { Elysia, t } from "elysia";
import { supabaseAdmin } from "../../lib/supabase";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import {
  UserRole,
  createUserAuthMetadata,
  createUserProfileMetadata,
  AuditAction,
} from "@supplex/types";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";
import { authCache } from "../../lib/auth-cache";
import { ApiError, Errors } from "../../lib/errors";

/**
 * PATCH /api/users/:id/role
 * Updates a user's role within the tenant
 *
 * Body:
 * - role: New role for the user
 *
 * Auth: Requires Admin role
 * Business Rules:
 * - Admin cannot change their own role (prevent privilege escalation)
 * - Must be in the same tenant as the target user
 */
export const updateRoleRoute = new Elysia({ prefix: "/users" })
  .use(authenticatedRoute)
  .use(requireAdmin)
  .patch(
    "/:id/role",
    async ({ params, body, user, headers, requestLogger }) => {
      try {
        const { id: targetUserId } = params;
        const { role } = body;
        const currentUserId = user.id;
        const tenantId = user.tenantId;
        const auditContext = createAuditContext(
          headers as Record<string, string | undefined>
        );

        // Validate role
        if (!Object.values(UserRole).includes(role as UserRole)) {
          throw Errors.badRequest(
            "Invalid role. Must be one of: admin, procurement_manager, quality_manager, viewer"
          );
        }

        // Prevent admin from changing their own role
        if (currentUserId === targetUserId) {
          throw Errors.forbidden("You cannot change your own role");
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

        const oldRole = targetUser.role;

        // Step 2: Update role in database
        const [updatedUser] = await db
          .update(users)
          .set({
            role: role as UserRole,
            updatedAt: new Date(),
          })
          .where(eq(users.id, targetUserId))
          .returning();

        if (!updatedUser) {
          throw new Error("Failed to update user role");
        }

        // Step 3: Update Supabase Auth metadata with role/tenant in app_metadata
        // TODO(SEC-009-cleanup): This app_metadata write is now redundant — the
        // custom_access_token_hook reads role/tenant_id from the users table on every
        // token refresh. Remove after hook is confirmed stable in production.
        const { error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
            app_metadata: createUserAuthMetadata(role as UserRole, tenantId),
            user_metadata: createUserProfileMetadata(updatedUser.fullName),
          });

        if (updateError) {
          requestLogger.error(
            { err: updateError },
            "Failed to update Supabase user metadata"
          );
          // Rollback database change
          await db
            .update(users)
            .set({ role: oldRole })
            .where(eq(users.id, targetUserId));

          throw Errors.internal(
            "Failed to sync role with authentication system"
          );
        }

        // Step 4: Invalidate auth cache
        // This ensures the user's new role takes effect immediately
        // instead of waiting for cache TTL (5 minutes) to expire
        await authCache.invalidate(targetUserId);

        // Log audit event
        await logAuditEvent({
          tenantId,
          userId: currentUserId,
          targetUserId,
          action: AuditAction.ROLE_CHANGED,
          details: {
            old_role: oldRole,
            new_role: role,
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
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error updating user role");
        throw Errors.internal("Internal server error");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        role: t.Union([
          t.Literal(UserRole.ADMIN),
          t.Literal(UserRole.PROCUREMENT_MANAGER),
          t.Literal(UserRole.QUALITY_MANAGER),
          t.Literal(UserRole.VIEWER),
        ]),
      }),
      detail: {
        summary: "Update user role",
        description: "Changes a user's role within the tenant",
        tags: ["Users"],
      },
    }
  );
