import { Elysia, t } from "elysia";
import { supabaseAdmin } from "../../lib/supabase";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import {
  UserRole,
  createUserAuthMetadata,
  createUserProfileMetadata,
  AuditAction,
} from "@supplex/types";
import type { InsertUser } from "@supplex/types";
import { requireAdmin } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";
import { ApiError, Errors } from "../../lib/errors";

/**
 * POST /api/users/invite
 * Invites a new user to the tenant with a specified role
 *
 * Body:
 * - email: User's email address
 * - role: User role (admin, procurement_manager, quality_manager, viewer)
 * - message: Optional welcome message
 *
 * Auth: Requires Admin role
 */
export const inviteUserRoute = new Elysia({ prefix: "/users" })
  .use(authenticatedRoute)
  .use(requireAdmin)
  .post(
    "/invite",
    async ({ body, user, set, headers, requestLogger }) => {
      try {
        const { email, role, message } = body;
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

        // Generate a temporary password (user will set their own via invitation email)
        const temporaryPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

        // Step 1: Create Supabase auth user
        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: temporaryPassword,
            email_confirm: false,
            user_metadata: {
              // We'll update this after creating the database record with proper metadata
              invited: true,
              invited_at: new Date().toISOString(),
              invitation_message: message || "",
            },
          });

        if (authError || !authUser.user) {
          requestLogger.error({ err: authError }, "Supabase auth error");
          throw Errors.badRequest(
            authError?.message || "Failed to create user account"
          );
        }

        const userId = authUser.user.id;

        try {
          // Step 2: Create user record in database
          const newUser: InsertUser = {
            id: userId,
            tenantId: tenantId,
            email,
            fullName: email.split("@")[0] || "User", // Temporary, user can update later
            role: role as UserRole,
            avatarUrl: null,
            isActive: true,
            lastLoginAt: null,
          };

          const [user] = await db.insert(users).values(newUser).returning();

          if (!user) {
            throw new Error("Failed to create user record");
          }

          // Step 3: Update Supabase Auth metadata with role/tenant in app_metadata
          // TODO(SEC-009-cleanup): This app_metadata write is now redundant — the
          // custom_access_token_hook reads role/tenant_id from the users table on every
          // token refresh. Remove after hook is confirmed stable in production.
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            app_metadata: createUserAuthMetadata(role as UserRole, tenantId),
            user_metadata: createUserProfileMetadata(newUser.fullName),
          });

          // Step 4: Send invitation email via Supabase
          // Supabase will send a password reset email that the user can use to set their password
          const { error: inviteError } =
            await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
              redirectTo: `${process.env.APP_URL || "http://localhost:3000"}/reset-password`,
            });

          if (inviteError) {
            requestLogger.warn(
              { err: inviteError },
              "Invitation email send failed"
            );
            // Non-fatal, user is still created
          }

          // Log audit event
          await logAuditEvent({
            tenantId,
            userId: user.id,
            targetUserId: user.id,
            action: AuditAction.USER_INVITED,
            details: {
              email,
              role,
              invited_by: user.email,
              message: message || null,
            },
            ...auditContext,
          });

          set.status = 201;
          return {
            success: true,
            data: {
              user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                tenantId: user.tenantId,
                isActive: user.isActive,
              },
              invitationSent: !inviteError,
            },
          };
        } catch (dbError: any) {
          requestLogger.error(
            { err: dbError },
            "Database error during invitation"
          );

          // Rollback: Delete the Supabase auth user
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (rollbackError) {
            requestLogger.error(
              { err: rollbackError },
              "Failed to rollback auth user after invitation failure"
            );
          }

          if (dbError instanceof ApiError) throw dbError;
          throw Errors.internal("Failed to create user record");
        }
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Invitation error");
        throw Errors.internal("Internal server error during invitation");
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email", maxLength: 255 }),
        role: t.Union([
          t.Literal(UserRole.ADMIN),
          t.Literal(UserRole.PROCUREMENT_MANAGER),
          t.Literal(UserRole.QUALITY_MANAGER),
          t.Literal(UserRole.VIEWER),
        ]),
        message: t.Optional(t.String({ maxLength: 500 })),
      }),
      detail: {
        summary: "Invite new user to tenant",
        description: "Creates a new user account and sends an invitation email",
        tags: ["Users"],
      },
    }
  );
