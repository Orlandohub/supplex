import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users, userInvitations } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireRole } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { randomBytes } from "crypto";
import { ApiError, Errors } from "../../lib/errors";

/**
 * POST /api/users/resend-invitation
 * Resend invitation to user with pending_activation status
 *
 * Auth: Requires Admin role
 * Tenant Scoping: Automatically filtered by user's tenant_id
 * Action: Invalidates previous invitation and generates new one
 */
export const resendInvitationRoute = new Elysia({ prefix: "/users" })
  .use(authenticatedRoute)
  .use(requireRole([UserRole.ADMIN]))
  .post(
    "/resend-invitation",
    async ({ body, user, set, requestLogger }) => {
      try {
        const { userId } = body;
        const tenantId = user.tenantId;
        const currentUserId = user.id;

        // Step 1: Verify user exists and belongs to current tenant
        const targetUser = await db.query.users.findFirst({
          where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
        });

        if (!targetUser) {
          throw Errors.notFound(
            "User not found or does not belong to your organization",
            "USER_NOT_FOUND"
          );
        }

        // Step 2: Verify user status is pending_activation
        if (targetUser.status !== "pending_activation") {
          throw Errors.badRequest(
            `Cannot resend invitation. User status must be 'pending_activation'. Current status: '${targetUser.status}'`,
            "INVALID_STATUS"
          );
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
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error resending invitation");
        throw Errors.internal("Failed to resend invitation");
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
