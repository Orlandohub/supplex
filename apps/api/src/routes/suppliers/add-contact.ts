import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users, suppliers, userInvitations } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole, createUserAuthMetadata, createUserProfileMetadata } from "@supplex/types";
import { supabaseAdmin } from "../../lib/supabase";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";
import { AuditAction } from "@supplex/types";
import { randomBytes } from "crypto";
import { ApiError, Errors } from "../../lib/errors";

export const addContactRoute = new Elysia()
  .use(authenticate)
  .post(
    "/suppliers/:id/contact",
    async ({ params, body, user, set, headers, requestLogger }) => {
      // Check role: Admin or Procurement Manager
      if (
        !user?.role ||
        ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(user.role)
      ) {
        throw Errors.forbidden("Access denied. Required role: Admin or Procurement Manager");
      }

      try {
        const tenantId = user.tenantId as string;
        const userId = user.id as string;
        const supplierId = params.id;
        const { name, email, phone } = body;
        const auditContext = createAuditContext(headers);

        // Step 1: Verify supplier exists and belongs to tenant
        const supplier = await db.query.suppliers.findFirst({
          where: and(
            eq(suppliers.id, supplierId),
            eq(suppliers.tenantId, tenantId),
            isNull(suppliers.deletedAt)
          ),
        });

        if (!supplier) {
          throw Errors.notFound("Supplier not found");
        }

        // Step 2: Verify supplier does NOT already have a contact
        if (supplier.supplierUserId) {
          throw new ApiError(400, "SUPPLIER_HAS_CONTACT", "This supplier already has a contact user. Use the edit contact feature to update existing contact.");
        }

        // Step 3: Check email uniqueness
        const existingUser = await db.query.users.findFirst({
          where: and(
            eq(users.tenantId, tenantId),
            eq(users.email, email)
          ),
        });

        if (existingUser) {
          throw new ApiError(409, "USER_EMAIL_EXISTS", "A user with this email already exists in your organization");
        }

        // Step 4: Create Supabase Auth user
        // TODO(SEC-009-cleanup): The app_metadata write below is now redundant — the
        // custom_access_token_hook reads role/tenant_id from the users table on every
        // token refresh. Remove after hook is confirmed stable in production.
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          app_metadata: createUserAuthMetadata(UserRole.SUPPLIER_USER, tenantId),
          user_metadata: createUserProfileMetadata(name),
        });

        if (authError || !authUser.user) {
          requestLogger.error({ err: authError }, "Supabase user creation failed");
          throw new Error(`Failed to create Supabase user: ${authError?.message}`);
        }

        let newUserId: string | null = null;
        let invitationToken: string | null = null;

        try {
          // Step 5: Create local user record
          const [newUser] = await db.insert(users).values({
            id: authUser.user.id,
            tenantId,
            email,
            fullName: name,
            role: UserRole.SUPPLIER_USER,
            status: "pending_activation",
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();

          if (!newUser) {
            throw new Error("Failed to create user record");
          }

          newUserId = newUser.id;

          // Step 6: Generate secure invitation token
          const token = randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

          // Insert invitation record
          await db.insert(userInvitations).values({
            userId: newUser.id,
            tenantId,
            token,
            expiresAt,
            createdBy: userId,
            createdAt: new Date(),
          });

          invitationToken = token;

          // Step 7: Update supplier with new contact user ID
          await db
            .update(suppliers)
            .set({
              supplierUserId: newUserId,
              updatedAt: new Date(),
            })
            .where(eq(suppliers.id, supplierId));

          // Step 8: Log audit event
          await logAuditEvent({
            tenantId,
            userId,
            targetUserId: newUserId,
            action: AuditAction.SUPPLIER_CONTACT_ADDED,
            details: {
              supplier_id: supplierId,
              supplier_name: supplier.name,
              contact_name: name,
              contact_email: email,
              contact_phone: phone || null,
            },
            ...auditContext,
          });

          set.status = 201;
          return {
            success: true,
            data: {
              supplierUser: {
                id: newUser.id,
                email: newUser.email,
                fullName: newUser.fullName,
                role: newUser.role,
                status: newUser.status,
                isActive: newUser.isActive,
                createdAt: newUser.createdAt,
              },
              invitationToken,
            },
            message: `Supplier contact created successfully. Platform access granted to ${name}.`,
          };
        } catch (error) {
          // Cleanup: Delete Supabase Auth user if local operations failed
          if (authUser.user.id) {
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          }
          throw error;
        }
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error adding supplier contact");
        throw Errors.internal("Failed to add supplier contact");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200 }),
        email: t.String({ format: "email", maxLength: 255 }),
        phone: t.Optional(t.String({ maxLength: 50 })),
      }),
      detail: {
        summary: "Add contact user to supplier",
        description: "Creates a new supplier_user and links them to the supplier",
        tags: ["Suppliers"],
      },
    }
  );

