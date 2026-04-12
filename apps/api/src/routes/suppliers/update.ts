import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers } from "@supplex/db";
import { and, eq, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole, UpdateSupplierSchema } from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

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
      requestLogger,
    }: any) => {
      // Check role permission
      if (
        !user?.role ||
        ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(
          user.role as UserRole
        )
      ) {
        throw Errors.forbidden("Access denied. Required role: Admin or Procurement Manager");
      }
      try {
        const { id } = params;
        const tenantId = user.tenantId as string;
        const userId = user.id as string;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          throw new ApiError(400, "INVALID_ID", "Invalid supplier ID format. Must be a valid UUID.");
        }

        // Validate request body with Zod schema
        const validationResult = UpdateSupplierSchema.safeParse(body);

        if (!validationResult.success) {
          throw new ApiError(400, "VALIDATION_ERROR", "Invalid supplier data");
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
          throw Errors.notFound("Supplier not found or you don't have access to this supplier.");
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
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error updating supplier");

        const dbError = error as { code?: string; constraint?: string };
        if (
          dbError.code === "23505" &&
          dbError.constraint === "suppliers_tenant_tax_id_unique"
        ) {
          throw new ApiError(409, "DUPLICATE_TAX_ID", "A supplier with this Tax ID already exists in your organization");
        }

        throw Errors.internal("Failed to update supplier");
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
