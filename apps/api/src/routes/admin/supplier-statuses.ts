import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { supplierStatus, suppliers } from "@supplex/db";
import { eq, and, count } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

export const supplierStatusRoutes = new Elysia()
  .use(authenticate)
  .get(
    "/supplier-statuses",
    async ({ user, set }) => {
      if (!user?.id || !user?.tenantId) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      const rows = await db
        .select()
        .from(supplierStatus)
        .where(eq(supplierStatus.tenantId, user.tenantId))
        .orderBy(supplierStatus.displayOrder);

      return { success: true, data: rows };
    }
  )
  .post(
    "/supplier-statuses",
    async ({ body, user, set }) => {
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return { success: false, error: "Access denied. Admin role required." };
      }

      const { name, displayOrder, isDefault } = body;

      const [created] = await db
        .insert(supplierStatus)
        .values({
          tenantId: user.tenantId,
          name,
          displayOrder: displayOrder ?? 0,
          isDefault: isDefault ?? false,
        })
        .returning();

      return { success: true, data: created };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        displayOrder: t.Optional(t.Number()),
        isDefault: t.Optional(t.Boolean()),
      }),
    }
  )
  .patch(
    "/supplier-statuses/:id",
    async ({ params, body, user, set }) => {
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return { success: false, error: "Access denied. Admin role required." };
      }

      const [existing] = await db
        .select()
        .from(supplierStatus)
        .where(
          and(
            eq(supplierStatus.id, params.id),
            eq(supplierStatus.tenantId, user.tenantId)
          )
        );

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Supplier status not found" };
      }

      const [updated] = await db
        .update(supplierStatus)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
          updatedAt: new Date(),
        })
        .where(eq(supplierStatus.id, params.id))
        .returning();

      return { success: true, data: updated };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        displayOrder: t.Optional(t.Number()),
        isDefault: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete(
    "/supplier-statuses/:id",
    async ({ params, user, set }) => {
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return { success: false, error: "Access denied. Admin role required." };
      }

      const [existing] = await db
        .select()
        .from(supplierStatus)
        .where(
          and(
            eq(supplierStatus.id, params.id),
            eq(supplierStatus.tenantId, user.tenantId)
          )
        );

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Supplier status not found" };
      }

      const [usageCount] = await db
        .select({ cnt: count() })
        .from(suppliers)
        .where(eq(suppliers.supplierStatusId, params.id));

      if (usageCount && usageCount.cnt > 0) {
        set.status = 409;
        return {
          success: false,
          error: `Cannot delete: status is assigned to ${usageCount.cnt} supplier(s)`,
        };
      }

      await db
        .delete(supplierStatus)
        .where(eq(supplierStatus.id, params.id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
    }
  );
