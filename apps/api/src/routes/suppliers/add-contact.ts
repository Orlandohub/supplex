import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users, suppliers, userInvitations } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole, createUserMetadata } from "@supplex/types";
import { supabaseAdmin } from "../../lib/supabase";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";
import { AuditAction } from "@supplex/types";
import { randomBytes } from "crypto";

export const addContactRoute = new Elysia()
  .use(authenticate)
  .post(
    "/suppliers/:id/contact",
    async ({ params, body, user, set, headers }) => {
      // Check role: Admin or Procurement Manager
      if (
        !user?.role ||
        ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(user.role)
      ) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied. Required role: Admin or Procurement Manager",
            timestamp: new Date().toISOString(),
          },
        };
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Supplier not found",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Step 2: Verify supplier does NOT already have a contact
        if (supplier.supplierUserId) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "SUPPLIER_HAS_CONTACT",
              message: "This supplier already has a contact user. Use the edit contact feature to update existing contact.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Step 3: Check email uniqueness
        const existingUser = await db.query.users.findFirst({
          where: and(
            eq(users.tenantId, tenantId),
            eq(users.email, email)
          ),
        });

        if (existingUser) {
          set.status = 409;
          return {
            success: false,
            error: {
              code: "USER_EMAIL_EXISTS",
              message: "A user with this email already exists in your organization",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Step 4: Create Supabase Auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true, // Skip email verification
          user_metadata: createUserMetadata(UserRole.SUPPLIER_USER, tenantId, name),
        });

        if (authError || !authUser.user) {
          console.error("Supabase user creation failed:", authError);
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
        console.error("Error adding supplier contact:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to add supplier contact",
            timestamp: new Date().toISOString(),
          },
        };
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

