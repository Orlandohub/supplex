import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users, suppliers } from "@supplex/db";
import { eq, and, ne } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { supabaseAdmin } from "../../lib/supabase";
import { authCache } from "../../lib/auth-cache";
import { logAuditEvent, createAuditContext } from "../../lib/audit/logger";
import { AuditAction } from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

/**
 * PATCH /api/suppliers/:id/contact
 * Update supplier contact user information
 *
 * Auth: Requires Admin or Procurement Manager role
 * Tenant Scoping: Only updates supplier contacts within user's tenant
 *
 * Features:
 * - Updates contact name, email, and/or active status
 * - Enforces email uniqueness per tenant
 * - Syncs email changes to Supabase Auth
 * - Updates both isActive and status fields (data consistency)
 * - Invalidates auth cache on status change (security)
 * - Audit logging with before/after values
 *
 * Note: No prefix here - parent route (index.ts) provides "/api" prefix
 */
export const updateContactRoute = new Elysia().use(authenticatedRoute).patch(
  "/suppliers/:id/contact",
  async ({ params, body, user, headers, requestLogger }) => {
    // Check role: Admin or Procurement Manager
    if (
      !user?.role ||
      ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(user.role)
    ) {
      throw Errors.forbidden(
        "Access denied. Required role: Admin or Procurement Manager"
      );
    }

    try {
      const tenantId = user.tenantId;
      const supplierId = params.id;
      const { fullName, email, isActive } = body;
      const auditContext = createAuditContext(headers);

      // Step 1: Get supplier and verify tenant membership
      const supplier = await db.query.suppliers.findFirst({
        where: and(
          eq(suppliers.id, supplierId),
          eq(suppliers.tenantId, tenantId)
        ),
      });

      if (!supplier || !supplier.supplierUserId) {
        throw Errors.notFound("Supplier contact user not found");
      }

      const userId = supplier.supplierUserId;

      // Step 2: Get current user record
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!currentUser) {
        throw Errors.notFound("User record not found");
      }

      // Step 3: If email is changing, check uniqueness and sync to Supabase
      if (email && email !== currentUser.email) {
        // Check email uniqueness within tenant (exclude current user)
        const existingUser = await db.query.users.findFirst({
          where: and(
            eq(users.tenantId, tenantId),
            eq(users.email, email),
            ne(users.id, userId) // Exclude current user
          ),
        });

        if (existingUser) {
          throw new ApiError(
            409,
            "USER_EMAIL_EXISTS",
            "A user with this email already exists in your organization"
          );
        }

        // Update Supabase Auth email (BEFORE local DB update for transaction safety)
        const { error: authError } =
          await supabaseAdmin.auth.admin.updateUserById(userId, { email });

        if (authError) {
          requestLogger.error(
            { err: authError },
            "Failed to update Supabase email"
          );
          throw Errors.internal("Failed to update email. Please try again.");
        }
      }

      // Step 4: Build update object with BOTH isActive and status fields
      const updateData: any = { updatedAt: new Date() };
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;

      // CRITICAL: Update both isActive and status together
      if (isActive !== undefined) {
        updateData.isActive = isActive;
        updateData.status = isActive ? "active" : "deactivated";
      }

      // Step 5: Update local user record
      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) throw new Error("Failed to update supplier contact");

      // Step 6: Invalidate auth cache (CRITICAL for security)
      if (isActive !== undefined && isActive !== currentUser.isActive) {
        await authCache.invalidate(userId);
      }

      // Step 7: Log audit event
      await logAuditEvent({
        tenantId,
        userId: user.id,
        targetUserId: userId,
        action: AuditAction.SUPPLIER_CONTACT_UPDATED,
        details: {
          supplier_id: supplierId,
          supplier_name: supplier.name,
          old_email: currentUser.email,
          new_email: email || currentUser.email,
          old_name: currentUser.fullName,
          new_name: fullName || currentUser.fullName,
          old_is_active: currentUser.isActive,
          new_is_active:
            isActive !== undefined ? isActive : currentUser.isActive,
          old_status: currentUser.status,
          new_status: updatedUser.status,
        },
        ...auditContext,
      });

      return {
        success: true,
        data: {
          supplierUser: {
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.fullName,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            status: updatedUser.status,
            updatedAt: updatedUser.updatedAt,
          },
        },
        message: "Supplier contact updated successfully",
      };
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Error updating supplier contact");
      throw Errors.internal("Failed to update supplier contact");
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      fullName: t.Optional(t.String({ maxLength: 200 })),
      email: t.Optional(t.String({ format: "email", maxLength: 255 })),
      isActive: t.Optional(t.Boolean()),
    }),
    detail: {
      summary: "Update supplier contact user",
      description:
        "Updates the supplier contact's name, email, and/or status. Automatically syncs isActive with status field and invalidates auth cache when status changes.",
      tags: ["Suppliers"],
    },
  }
);
