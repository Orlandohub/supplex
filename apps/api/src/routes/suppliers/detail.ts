import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers, users } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate, requireRole } from "../../lib/rbac/middleware";
import { UserRole, SupplierStatus } from "@supplex/types";

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
    async ({ params, user, set }: any) => {
      try {
        const { id } = params;
        const tenantId = user.tenantId as string;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_ID",
              message: "Invalid supplier ID format. Must be a valid UUID.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Fetch supplier with user information (created_by, updated_by)
        const result = await db
          .select({
            supplier: suppliers,
            createdByUser: {
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message:
                "Supplier not found or you don't have access to this supplier.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        const { supplier, createdByUser } = result[0];

        // Enrich supplier with user information
        const enrichedSupplier = {
          ...supplier,
          createdByName: createdByUser
            ? `${createdByUser.firstName} ${createdByUser.lastName}`.trim()
            : "Unknown",
          createdByEmail: createdByUser?.email || null,
        };

        return {
          success: true,
          data: {
            supplier: enrichedSupplier,
          },
        };
      } catch (error: any) {
        console.error("Error fetching supplier detail:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch supplier details",
            timestamp: new Date().toISOString(),
          },
        };
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
    async ({ params, body, user, set }: any) => {
      try {
        const { id } = params;
        const { status } = body;
        const tenantId = user.tenantId as string;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_ID",
              message: "Invalid supplier ID format. Must be a valid UUID.",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Validate status enum
        const validStatuses = Object.values(SupplierStatus);
        if (!validStatuses.includes(status)) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_STATUS",
              message: `Invalid status value. Must be one of: ${validStatuses.join(", ")}`,
              timestamp: new Date().toISOString(),
            },
          };
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message:
                "Supplier not found or you don't have access to this supplier.",
              timestamp: new Date().toISOString(),
            },
          };
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
        console.error("Error updating supplier status:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update supplier status",
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
    async ({ params, user, set }: any) => {
      try {
        const { id } = params;
        const tenantId = user.tenantId as string;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_ID",
              message: "Invalid supplier ID format. Must be a valid UUID.",
              timestamp: new Date().toISOString(),
            },
          };
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
          set.status = 404;
          return {
            success: false,
            error: {
              code: "NOT_FOUND",
              message:
                "Supplier not found or you don't have access to this supplier.",
              timestamp: new Date().toISOString(),
            },
          };
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
        console.error("Error deleting supplier:", error);
        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to delete supplier",
            timestamp: new Date().toISOString(),
          },
        };
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
