import { Elysia, t } from "elysia";
import { db, documents } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requirePermission } from "../../lib/rbac/middleware";
import { PermissionAction } from "@supplex/types";
import { Errors } from "../../lib/errors";

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
  .use(requirePermission(PermissionAction.DELETE_DOCUMENTS))
  .delete(
    "/documents/:id",
    async ({ params, user, set }) => {
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
        throw Errors.notFound(
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
