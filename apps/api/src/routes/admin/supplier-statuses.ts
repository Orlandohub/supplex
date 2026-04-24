import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { supplierStatus, suppliers } from "@supplex/db";
import { eq, and, count } from "drizzle-orm";
import { Errors } from "../../lib/errors";
export const supplierStatusRoutes = new Elysia()
  .get("/supplier-statuses", async ({ user }: any) => {
    const rows = await db
      .select()
      .from(supplierStatus)
      .where(eq(supplierStatus.tenantId, user.tenantId))
      .orderBy(supplierStatus.displayOrder);

    return { success: true, data: rows };
  })
  .post(
    "/supplier-statuses",
    async ({ body, user }: any) => {
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
    async ({ params, body, user }: any) => {
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
        throw Errors.notFound("Supplier status not found");
      }

      const [updated] = await db
        .update(supplierStatus)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.displayOrder !== undefined
            ? { displayOrder: body.displayOrder }
            : {}),
          ...(body.isDefault !== undefined
            ? { isDefault: body.isDefault }
            : {}),
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
    async ({ params, user }: any) => {
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
        throw Errors.notFound("Supplier status not found");
      }

      const [usageCount] = await db
        .select({ cnt: count() })
        .from(suppliers)
        .where(eq(suppliers.supplierStatusId, params.id));

      if (usageCount && usageCount.cnt > 0) {
        throw Errors.conflict(
          `Cannot delete: status is assigned to ${usageCount.cnt} supplier(s)`
        );
      }

      await db.delete(supplierStatus).where(eq(supplierStatus.id, params.id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
    }
  );
