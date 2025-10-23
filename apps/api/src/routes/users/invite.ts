import { Elysia, t } from "elysia";
import { supabaseAdmin } from "../../lib/supabase";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import { UserRole, createUserMetadata, AuditAction } from "@supplex/types";
import type { InsertUser } from "@supplex/types";
import { requireAdmin } from "../../lib/rbac/middleware";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";

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
  .use(requireAdmin)
  .post(
    "/invite",
    async ({ body, user, set, headers }: any) => {
      try {
        const { email, role, message } = body;
        const tenantId = user.tenantId as string;
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
          console.error("Supabase auth error:", authError);
          set.status = 400;
          return {
            success: false,
            error: authError?.message || "Failed to create user account",
          };
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

          // Step 3: Update Supabase Auth user_metadata with role and tenant_id
          const userMetadata = createUserMetadata(
            role as UserRole,
            tenantId,
            newUser.fullName
          );

          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: userMetadata,
          });

          // Step 4: Send invitation email via Supabase
          // Supabase will send a password reset email that the user can use to set their password
          const { error: inviteError } =
            await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
              redirectTo: `${process.env.APP_URL || "http://localhost:3000"}/reset-password`,
            });

          if (inviteError) {
            console.warn("Failed to send invitation email:", inviteError);
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
          console.error("Database error during invitation:", dbError);

          // Rollback: Delete the Supabase auth user
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (rollbackError) {
            console.error("Failed to rollback auth user:", rollbackError);
          }

          set.status = 500;
          return {
            success: false,
            error: "Failed to create user record",
          };
        }
      } catch (error: any) {
        console.error("Invitation error:", error);
        set.status = 500;
        return {
          success: false,
          error: "Internal server error during invitation",
        };
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
