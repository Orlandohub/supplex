import { Elysia, t } from "elysia";
import { db, documents } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

/**
 * DELETE /api/documents/:id
 * Soft delete document (sets deleted_at timestamp)
 *
 * Auth: Requires Admin or Procurement Manager role
 * Tenant Scoping: Only allows deletion if document belongs to user's tenant
 *
 * Note: This is a soft delete - the file remains in storage for audit purposes
 */
export const deleteDocument = new Elysia({ prefix: "/api" })
  .use(authenticate)
  .delete(
    "/documents/:id",
    async ({ params, user, set }) => {
      // Check role permission
      if (
        !user?.role ||
        ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(
          user.role as UserRole
        )
      ) {
        set.status = 403;
        return {
          error: {
            code: "FORBIDDEN",
            message:
              "Access denied. Required role: Admin or Procurement Manager",
            timestamp: new Date().toISOString(),
          },
        };
      }

      const { id } = params;

      // Fetch document and verify tenant ownership
      const [document] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, id),
            eq(documents.tenantId, user.tenantId),
            isNull(documents.deletedAt) // Ensure not already deleted
          )
        )
        .limit(1);

      if (!document) {
        set.status = 404;
        throw new Error(
          "Document not found, already deleted, or does not belong to your tenant"
        );
      }

      // Soft delete: set deleted_at timestamp
      await db
        .update(documents)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      // Note: We do NOT delete the file from Supabase Storage
      // This preserves the file for audit and compliance purposes

      return {
        success: true,
        message: "Document deleted successfully",
      };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    }
  );
