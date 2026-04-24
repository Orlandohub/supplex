import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers, users } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate, requireRole } from "../../lib/rbac/middleware";
import { UserRole, SupplierStatus } from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/suppliers/:id
 * Returns detailed supplier information by ID
 *
 * Auth: Requires valid JWT (any authenticated user can view suppliers)
 * Tenant Scoping: Automatically filtered by user's tenant_id
 */
export const supplierDetailRoutes = new Elysia({ prefix: "/suppliers" })
  .use(authenticate)
  .get(
    "/:id",
    async ({ params, user, requestLogger }: any) => {
      try {
        const { id } = params;
        const tenantId = user.tenantId as string;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          throw new ApiError(
            400,
            "INVALID_ID",
            "Invalid supplier ID format. Must be a valid UUID."
          );
        }

        // Fetch supplier with user information (created_by)
        const result = await db
          .select({
            supplier: suppliers,
            createdByUser: {
              id: users.id,
              email: users.email,
              fullName: users.fullName,
            },
          })
          .from(suppliers)
          .leftJoin(users, eq(suppliers.createdBy, users.id))
          .where(
            and(
              eq(suppliers.id, id),
              eq(suppliers.tenantId, tenantId),
              isNull(suppliers.deletedAt)
            )
          )
          .limit(1);

        if (!result || result.length === 0) {
          throw Errors.notFound(
            "Supplier not found or you don't have access to this supplier."
          );
        }

        const firstRow = result[0];
        if (!firstRow)
          throw Errors.notFound(
            "Supplier not found or you don't have access to this supplier."
          );
        const { supplier, createdByUser } = firstRow;

        // Entity-level authorization: supplier_user can only view their own supplier
        if (user.role === UserRole.SUPPLIER_USER) {
          if (supplier.supplierUserId !== user.id) {
            throw Errors.forbidden(
              "Access denied: you can only view your own supplier"
            );
          }
        }

        // Fetch supplier user if supplierUserId exists
        let supplierUser = null;
        if (supplier.supplierUserId) {
          supplierUser = await db.query.users.findFirst({
            where: eq(users.id, supplier.supplierUserId),
            columns: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              status: true,
              isActive: true,
            },
          });
        }

        // Enrich supplier with user information
        const enrichedSupplier = {
          ...supplier,
          createdByName: createdByUser?.fullName || "Unknown",
          createdByEmail: createdByUser?.email || null,
        };

        return {
          success: true,
          data: {
            supplier: enrichedSupplier,
            supplierUser,
          },
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error fetching supplier detail");
        throw Errors.internal("Failed to fetch supplier details");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Get supplier by ID",
        description: "Returns detailed information for a single supplier",
        tags: ["Suppliers"],
      },
    }
  )
  .use(requireRole([UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER]))
  .patch(
    "/:id/status",
    async ({ params, body, user, requestLogger }: any) => {
      try {
        const { id } = params;
        const { status } = body;
        const tenantId = user.tenantId as string;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          throw new ApiError(
            400,
            "INVALID_ID",
            "Invalid supplier ID format. Must be a valid UUID."
          );
        }

        // Validate status enum
        const validStatuses = Object.values(SupplierStatus);
        if (!validStatuses.includes(status)) {
          throw new ApiError(
            400,
            "INVALID_STATUS",
            `Invalid status value. Must be one of: ${validStatuses.join(", ")}`
          );
        }

        // Check if supplier exists and belongs to tenant
        const existingSupplier = await db
          .select()
          .from(suppliers)
          .where(
            and(
              eq(suppliers.id, id),
              eq(suppliers.tenantId, tenantId),
              isNull(suppliers.deletedAt)
            )
          )
          .limit(1);

        if (!existingSupplier || existingSupplier.length === 0) {
          throw Errors.notFound(
            "Supplier not found or you don't have access to this supplier."
          );
        }

        // Update supplier status
        const updatedSupplier = await db
          .update(suppliers)
          .set({
            status,
            updatedAt: new Date(),
          })
          .where(eq(suppliers.id, id))
          .returning();

        // TODO: Record status change in audit history
        // When audit log table is implemented, add entry here with:
        // - old status, new status, user who made change, timestamp, optional note

        return {
          success: true,
          data: {
            supplier: updatedSupplier[0],
          },
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error updating supplier status");
        throw Errors.internal("Failed to update supplier status");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        status: t.String(),
        note: t.Optional(t.String()),
      }),
      detail: {
        summary: "Update supplier status",
        description:
          "Updates the status of a supplier (Admin/Procurement Manager only)",
        tags: ["Suppliers"],
      },
    }
  )
  .use(requireRole([UserRole.ADMIN]))
  .delete(
    "/:id",
    async ({ params, user, requestLogger }: any) => {
      try {
        const { id } = params;
        const tenantId = user.tenantId as string;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          throw new ApiError(
            400,
            "INVALID_ID",
            "Invalid supplier ID format. Must be a valid UUID."
          );
        }

        // Check if supplier exists and belongs to tenant
        const existingSupplier = await db
          .select()
          .from(suppliers)
          .where(
            and(
              eq(suppliers.id, id),
              eq(suppliers.tenantId, tenantId),
              isNull(suppliers.deletedAt)
            )
          )
          .limit(1);

        if (!existingSupplier || existingSupplier.length === 0) {
          throw Errors.notFound(
            "Supplier not found or you don't have access to this supplier."
          );
        }

        // Soft delete: Set deleted_at timestamp
        await db
          .update(suppliers)
          .set({
            deletedAt: new Date(),
          })
          .where(eq(suppliers.id, id));

        // TODO: Record deletion in audit history
        // When audit log table is implemented, add entry here with:
        // - action: DELETE, entity: supplier, user who deleted, timestamp

        return {
          success: true,
          data: {
            message: "Supplier deleted successfully",
          },
        };
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error deleting supplier");
        throw Errors.internal("Failed to delete supplier");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Delete supplier",
        description: "Soft deletes a supplier (Admin only)",
        tags: ["Suppliers"],
      },
    }
  );
