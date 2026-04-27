import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowType, workflowTemplate, supplierStatus } from "@supplex/db";
import { eq, and, count } from "drizzle-orm";
import { Errors } from "../../lib/errors";
import { authenticatedRoute } from "../../lib/route-plugins";

export const workflowTypeRoutes = new Elysia()
  .use(authenticatedRoute)
  .get("/workflow-types", async ({ user }) => {
    const rows = await db
      .select({
        id: workflowType.id,
        tenantId: workflowType.tenantId,
        name: workflowType.name,
        supplierStatusId: workflowType.supplierStatusId,
        supplierStatusName: supplierStatus.name,
        createdAt: workflowType.createdAt,
        updatedAt: workflowType.updatedAt,
      })
      .from(workflowType)
      .leftJoin(
        supplierStatus,
        eq(workflowType.supplierStatusId, supplierStatus.id)
      )
      .where(eq(workflowType.tenantId, user.tenantId))
      .orderBy(workflowType.name);

    return { success: true, data: rows };
  })
  .post(
    "/workflow-types",
    async ({ body, user }) => {
      const { name, supplierStatusId } = body;

      const [created] = await db
        .insert(workflowType)
        .values({
          tenantId: user.tenantId,
          name,
          supplierStatusId: supplierStatusId || null,
        })
        .returning();

      return { success: true, data: created };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 200 }),
        supplierStatusId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
      }),
    }
  )
  .patch(
    "/workflow-types/:id",
    async ({ params, body, user }) => {
      const [existing] = await db
        .select()
        .from(workflowType)
        .where(
          and(
            eq(workflowType.id, params.id),
            eq(workflowType.tenantId, user.tenantId)
          )
        );

      if (!existing) {
        throw Errors.notFound("Workflow type not found");
      }

      const [updated] = await db
        .update(workflowType)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.supplierStatusId !== undefined
            ? { supplierStatusId: body.supplierStatusId }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(workflowType.id, params.id))
        .returning();

      return { success: true, data: updated };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        supplierStatusId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
      }),
    }
  )
  .delete(
    "/workflow-types/:id",
    async ({ params, user }) => {
      const [existing] = await db
        .select()
        .from(workflowType)
        .where(
          and(
            eq(workflowType.id, params.id),
            eq(workflowType.tenantId, user.tenantId)
          )
        );

      if (!existing) {
        throw Errors.notFound("Workflow type not found");
      }

      const [usageCount] = await db
        .select({ cnt: count() })
        .from(workflowTemplate)
        .where(eq(workflowTemplate.workflowTypeId, params.id));

      if (usageCount && usageCount.cnt > 0) {
        throw Errors.conflict(
          `Cannot delete: type is used by ${usageCount.cnt} workflow template(s)`
        );
      }

      await db.delete(workflowType).where(eq(workflowType.id, params.id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
    }
  );
