import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users, userInvitations } from "@supplex/db";
import { eq } from "drizzle-orm";
import { supabaseAdmin } from "../../lib/supabase";

/**
 * POST /api/auth/accept-invitation
 * Accept user invitation and set password
 *
 * Public endpoint - no authentication required
 * Validates invitation token and sets password for pending users
 */
export const acceptInvitationRoute = new Elysia({ prefix: "/auth" }).post(
  "/accept-invitation",
  async ({ body, set }: any) => {
    try {
      const { token, password } = body;

      // Step 1: Look up invitation by token
      const invitation = await db.query.userInvitations.findFirst({
        where: eq(userInvitations.token, token),
      });

      if (!invitation) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Invitation link is invalid",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Step 2: Check if invitation is not used (usedAt IS NULL)
      if (invitation.usedAt) {
        set.status = 409;
        return {
          success: false,
          error: {
            code: "INVITATION_USED",
            message: "This invitation link has already been used",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Step 3: Check if invitation is not expired (expiresAt > NOW())
      if (new Date(invitation.expiresAt) < new Date()) {
        set.status = 410;
        return {
          success: false,
          error: {
            code: "INVITATION_EXPIRED",
            message: "Invitation link has expired",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Step 4: Validate password
      if (!password || password.length < 8) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "WEAK_PASSWORD",
            message: "Password must be at least 8 characters long",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Basic password complexity check
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "WEAK_PASSWORD",
            message:
              "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Get user record
      const user = await db.query.users.findFirst({
        where: eq(users.id, invitation.userId),
      });

      if (!user) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "User account not found",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Step 5: Update Supabase Auth user password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        {
          password,
        }
      );

      if (updateError) {
        console.error("Error updating user password:", updateError);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to set password",
            timestamp: new Date().toISOString(),
          },
        };
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
      console.error("Error accepting invitation:", error);

      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to accept invitation",
          timestamp: new Date().toISOString(),
        },
      };
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

