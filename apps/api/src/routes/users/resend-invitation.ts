import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users, userInvitations } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate, requireRole } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { randomBytes } from "crypto";

/**
 * POST /api/users/resend-invitation
 * Resend invitation to user with pending_activation status
 *
 * Auth: Requires Admin role
 * Tenant Scoping: Automatically filtered by user's tenant_id
 * Action: Invalidates previous invitation and generates new one
 */
export const resendInvitationRoute = new Elysia({ prefix: "/users" })
  .use(authenticate)
  .use(requireRole([UserRole.ADMIN]))
  .post(
    "/resend-invitation",
    async ({ body, user, set }: any) => {
      try {
        const { userId } = body;
        const tenantId = user.tenantId as string;
        const currentUserId = user.id as string;

        // Step 1: Verify user exists and belongs to current tenant
        const targetUser = await db.query.users.findFirst({
          where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
        });

        if (!targetUser) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found or does not belong to your organization",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Step 2: Verify user status is pending_activation
        if (targetUser.status !== "pending_activation") {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_STATUS",
              message: `Cannot resend invitation. User status must be 'pending_activation'. Current status: '${targetUser.status}'`,
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Step 3: Mark all existing invitations as used (invalidate them)
        await db
          .update(userInvitations)
          .set({
            usedAt: new Date(),
          })
          .where(
            and(
              eq(userInvitations.userId, userId),
              isNull(userInvitations.usedAt)
            )
          );

        // Step 4: Generate new secure token
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

        // Step 5: Insert new invitation record
        const [_newInvitation] = await db
          .insert(userInvitations)
          .values({
            userId,
            tenantId,
            token,
            expiresAt,
            createdBy: currentUserId,
            createdAt: new Date(),
          })
          .returning();

        set.status = 200;
        return {
          success: true,
          data: {
            token,
            expiresAt,
            message: "New invitation generated successfully",
          },
        };
      } catch (error: any) {
        console.error("Error resending invitation:", error);

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to resend invitation",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      body: t.Object({
        userId: t.String(),
      }),
      detail: {
        summary: "Resend user invitation",
        description:
          "Generates new invitation link for user with pending_activation status (Admin only)",
        tags: ["Users"],
      },
    }
  );

