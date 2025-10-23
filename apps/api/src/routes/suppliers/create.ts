import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers } from "@supplex/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireRole } from "../../lib/rbac/middleware";
import { UserRole, InsertSupplierSchema } from "@supplex/types";

/**
 * POST /api/suppliers
 * Create a new supplier
 *
 * Auth: Requires Admin or Procurement Manager role
 * Tenant Scoping: Automatically sets tenant_id from authenticated user's JWT
 */
export const createSupplierRoute = new Elysia({ prefix: "/suppliers" })
  .use(requireRole([UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER]))
  .post(
    "/",
    async ({ body, user, set }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const userId = user.id as string;

        // Validate request body with Zod schema
        const validationResult = InsertSupplierSchema.safeParse(body);

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

        const supplierData = validationResult.data;

        // Check for duplicate supplier name (fuzzy match) unless forceSave is true
        if (!body.forceSave) {
          const duplicateCheck = await db
            .select({
              id: suppliers.id,
              name: suppliers.name,
            })
            .from(suppliers)
            .where(
              and(
                eq(suppliers.tenantId, tenantId),
                isNull(suppliers.deletedAt),
                sql`LOWER(${suppliers.name}) LIKE LOWER(${"%" + supplierData.name + "%"})`
              )
            )
            .limit(5);

          if (duplicateCheck.length > 0) {
            set.status = 409;
            return {
              success: false,
              error: {
                code: "DUPLICATE_SUPPLIER",
                message: "A supplier with a similar name already exists",
                duplicates: duplicateCheck,
                timestamp: new Date().toISOString(),
              },
            };
          }
        }

        // Insert new supplier
        const newSupplier = await db
          .insert(suppliers)
          .values({
            ...supplierData,
            tenantId,
            createdBy: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        set.status = 201;
        return {
          success: true,
          data: {
            supplier: newSupplier[0],
          },
        };
      } catch (error: any) {
        console.error("Error creating supplier:", error);

        // Handle unique constraint violation (duplicate tax_id)
        if (
          error.code === "23505" &&
          error.constraint === "suppliers_tenant_tax_id_unique"
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
            message: "Failed to create supplier",
            timestamp: new Date().toISOString(),
          },
        };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        taxId: t.String(),
        category: t.String(),
        status: t.Optional(t.String()),
        contactName: t.String(),
        contactEmail: t.String(),
        contactPhone: t.Optional(t.String()),
        address: t.Object({
          street: t.String(),
          city: t.String(),
          state: t.String(),
          postalCode: t.String(),
          country: t.String(),
        }),
        website: t.Optional(t.String()),
        certifications: t.Optional(t.Array(t.Any())),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
        riskScore: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
        forceSave: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Create new supplier",
        description: "Creates a new supplier (Admin/Procurement Manager only)",
        tags: ["Suppliers"],
      },
    }
  );
