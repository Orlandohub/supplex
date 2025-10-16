import { Elysia, t } from "elysia";
import { supabaseAdmin } from "../../lib/supabase";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { UserRole, createUserMetadata, AuditAction } from "@supplex/types";
import { requireAdmin } from "../../lib/rbac/middleware";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";

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
  .use(requireAdmin)
  .patch(
    "/:id/role",
    async ({ params, body, user, set, headers }) => {
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
          set.status = 400;
          return {
            success: false,
            error:
              "Invalid role. Must be one of: admin, procurement_manager, quality_manager, viewer",
          };
        }

        // Prevent admin from changing their own role
        if (currentUserId === targetUserId) {
          set.status = 403;
          return {
            success: false,
            error: "You cannot change your own role",
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

        // Step 3: Update Supabase Auth user_metadata
        const userMetadata = createUserMetadata(
          role as UserRole,
          tenantId,
          updatedUser.fullName
        );

        const { error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
            user_metadata: userMetadata,
          });

        if (updateError) {
          console.error(
            "Failed to update Supabase user metadata:",
            updateError
          );
          // Rollback database change
          await db
            .update(users)
            .set({ role: oldRole })
            .where(eq(users.id, targetUserId));

          set.status = 500;
          return {
            success: false,
            error: "Failed to sync role with authentication system",
          };
        }

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
      } catch (error: any) {
        console.error("Error updating user role:", error);
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
