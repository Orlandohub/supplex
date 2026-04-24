import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users, userInvitations } from "@supplex/db";
import { eq } from "drizzle-orm";
import { supabaseAdmin } from "../../lib/supabase";
import { ApiError, Errors } from "../../lib/errors";

/**
 * POST /api/auth/accept-invitation
 * Accept user invitation and set password
 *
 * Public endpoint - no authentication required
 * Validates invitation token and sets password for pending users
 */
export const acceptInvitationRoute = new Elysia({ prefix: "/auth" }).post(
  "/accept-invitation",
  async ({ body, set, requestLogger }: any) => {
    try {
      const { token, password } = body;

      // Step 1: Look up invitation by token
      const invitation = await db.query.userInvitations.findFirst({
        where: eq(userInvitations.token, token),
      });

      if (!invitation) {
        throw new ApiError(404, "INVALID_TOKEN", "Invitation link is invalid");
      }

      // Step 2: Check if invitation is not used (usedAt IS NULL)
      if (invitation.usedAt) {
        throw Errors.conflict("This invitation link has already been used");
      }

      // Step 3: Check if invitation is not expired (expiresAt > NOW())
      if (new Date(invitation.expiresAt) < new Date()) {
        throw new ApiError(
          410,
          "INVITATION_EXPIRED",
          "Invitation link has expired"
        );
      }

      // Step 4: Validate password
      if (!password || password.length < 8) {
        throw Errors.badRequest(
          "Password must be at least 8 characters long",
          "WEAK_PASSWORD"
        );
      }

      // Basic password complexity check
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        throw Errors.badRequest(
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
          "WEAK_PASSWORD"
        );
      }

      // Get user record
      const user = await db.query.users.findFirst({
        where: eq(users.id, invitation.userId),
      });

      if (!user) {
        throw Errors.notFound("User account not found");
      }

      // Step 5: Update Supabase Auth user password
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password,
        });

      if (updateError) {
        requestLogger.error(
          { err: updateError },
          "Error updating user password"
        );
        throw Errors.internal("Failed to set password");
      }

      // Step 6: Update user status to active
      await db
        .update(users)
        .set({
          status: "active",
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Step 7: Mark invitation as used
      await db
        .update(userInvitations)
        .set({
          usedAt: new Date(),
        })
        .where(eq(userInvitations.id, invitation.id));

      set.status = 200;
      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
          },
        },
      };
    } catch (error: any) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Error accepting invitation");
      throw Errors.internal("Failed to accept invitation");
    }
  },
  {
    body: t.Object({
      token: t.String(),
      password: t.String(),
    }),
    detail: {
      summary: "Accept user invitation",
      description: "Accept invitation and set password for new user account",
      tags: ["Auth"],
    },
  }
);
