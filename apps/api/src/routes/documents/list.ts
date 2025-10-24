import { Elysia, t } from "elysia";
import { db, documents } from "@supplex/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

/**
 * GET /api/suppliers/:id/documents
 * Fetch all documents for a supplier
 *
 * Auth: Requires authentication (any role)
 * Tenant Scoping: Only returns documents for user's tenant
 */
export const listDocuments = new Elysia({ prefix: "/api" })
  .use(authenticate)
  .get(
    "/suppliers/:id/documents",
    async ({ params, user, set }) => {
      const { id: supplierId } = params;

      // Fetch documents for supplier, filtered by tenant and non-deleted
      const supplierDocuments = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.supplierId, supplierId),
            eq(documents.tenantId, user.tenantId),
            isNull(documents.deletedAt)
          )
        )
        .orderBy(desc(documents.createdAt)); // Newest first

      // If no documents found but we need to verify supplier exists
      if (supplierDocuments.length === 0) {
        // Query the supplier to ensure it exists and belongs to this tenant
        const { suppliers } = await import("@supplex/db");
        const supplier = await db
          .select()
          .from(suppliers)
          .where(
            and(
              eq(suppliers.id, supplierId),
              eq(suppliers.tenantId, user.tenantId),
              isNull(suppliers.deletedAt)
            )
          )
          .limit(1);

        if (supplier.length === 0) {
          set.status = 404;
          throw new Error(
            "Supplier not found or does not belong to your tenant"
          );
        }
      }

      return {
        documents: supplierDocuments,
      };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    }
  );
