import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers } from "@supplex/db";
import { and, eq, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole, UpdateSupplierSchema } from "@supplex/types";

/**
 * PUT /api/suppliers/:id
 * Update an existing supplier
 *
 * Auth: Requires Admin or Procurement Manager role
 * Tenant Scoping: Updates only if supplier belongs to user's tenant
 */
export const updateSupplierRoute = new Elysia({ prefix: "/suppliers" })
  .use(authenticate)
  .put(
    "/:id",
    async ({
      params,
      body,
      user,
      set,
    }: {
      params: { id: string };
      body: Record<string, unknown>;
      user: { tenantId: string; id: string; role: string };
      set: { status: number };
    }) => {
      // Check role permission
      if (
        !user?.role ||
        ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(
          user.role as UserRole
        )
      ) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message:
              "Access denied. Required role: Admin or Procurement Manager",
            timestamp: new Date().toISOString(),
          },
        };
      }
      try {
        const { id } = params;
        const tenantId = user.tenantId as string;
        const userId = user.id as string;

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

        // Validate request body with Zod schema
        const validationResult = UpdateSupplierSchema.safeParse(body);

        if (!validationResult.success) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid supplier data",
              errors: validationResult.error.errors.map((err) => ({
                field: err.path.join("."),
                message: err.message,
              })),
              timestamp: new Date().toISOString(),
            },
          };
        }

        const updateData = validationResult.data;

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

        // Update supplier with provided fields only
        const updatedSupplier = await db
          .update(suppliers)
          .set({
            ...updateData,
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(eq(suppliers.id, id))
          .returning();

        // TODO: Record update in audit history
        // When audit log table is implemented, add entry here with:
        // - action: UPDATE, entity: supplier, changes made, user who updated, timestamp

        return {
          success: true,
          data: {
            supplier: updatedSupplier[0],
          },
        };
      } catch (error: unknown) {
        console.error("Error updating supplier:", error);

        // Handle unique constraint violation (duplicate tax_id)
        const dbError = error as { code?: string; constraint?: string };
        if (
          dbError.code === "23505" &&
          dbError.constraint === "suppliers_tenant_tax_id_unique"
        ) {
          set.status = 409;
          return {
            success: false,
            error: {
              code: "DUPLICATE_TAX_ID",
              message:
                "A supplier with this Tax ID already exists in your organization",
              timestamp: new Date().toISOString(),
            },
          };
        }

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to update supplier",
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
        name: t.Optional(t.String()),
        taxId: t.Optional(t.String()),
        category: t.Optional(t.String()),
        status: t.Optional(t.String()),
        contactName: t.Optional(t.String()),
        contactEmail: t.Optional(t.String()),
        contactPhone: t.Optional(t.String()),
        address: t.Optional(
          t.Object({
            street: t.String(),
            city: t.String(),
            state: t.String(),
            postalCode: t.String(),
            country: t.String(),
          })
        ),
        website: t.Optional(t.String()),
        certifications: t.Optional(t.Array(t.Any())),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
        riskScore: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
      }),
      detail: {
        summary: "Update supplier",
        description:
          "Updates an existing supplier (Admin/Procurement Manager only)",
        tags: ["Suppliers"],
      },
    }
  );
