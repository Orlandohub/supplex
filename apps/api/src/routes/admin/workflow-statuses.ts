import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { workflowStatus, workflowStepTemplate } from "@supplex/db";
import { eq, and, count } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";

export const workflowStatusRoutes = new Elysia()
  .use(authenticate)
  .get(
    "/workflow-statuses",
    async ({ user, set }) => {
      if (!user?.id || !user?.tenantId) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      const rows = await db
        .select()
        .from(workflowStatus)
        .where(eq(workflowStatus.tenantId, user.tenantId))
        .orderBy(workflowStatus.displayOrder);

      return { success: true, data: rows };
    }
  )
  .post(
    "/workflow-statuses",
    async ({ body, user, set }) => {
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return { success: false, error: "Access denied. Admin role required." };
      }

      const { name, displayOrder } = body;

      const [created] = await db
        .insert(workflowStatus)
        .values({
          tenantId: user.tenantId,
          name,
          displayOrder: displayOrder ?? 0,
        })
        .returning();

      return { success: true, data: created };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        displayOrder: t.Optional(t.Number()),
      }),
    }
  )
  .patch(
    "/workflow-statuses/:id",
    async ({ params, body, user, set }) => {
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return { success: false, error: "Access denied. Admin role required." };
      }

      const [existing] = await db
        .select()
        .from(workflowStatus)
        .where(
          and(
            eq(workflowStatus.id, params.id),
            eq(workflowStatus.tenantId, user.tenantId)
          )
        );

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Workflow status not found" };
      }

      const [updated] = await db
        .update(workflowStatus)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
          updatedAt: new Date(),
        })
        .where(eq(workflowStatus.id, params.id))
        .returning();

      return { success: true, data: updated };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        displayOrder: t.Optional(t.Number()),
      }),
    }
  )
  .delete(
    "/workflow-statuses/:id",
    async ({ params, user, set }) => {
      if (!user?.role || user.role !== UserRole.ADMIN) {
        set.status = 403;
        return { success: false, error: "Access denied. Admin role required." };
      }

      const [existing] = await db
        .select()
        .from(workflowStatus)
        .where(
          and(
            eq(workflowStatus.id, params.id),
            eq(workflowStatus.tenantId, user.tenantId)
          )
        );

      if (!existing) {
        set.status = 404;
        return { success: false, error: "Workflow status not found" };
      }

      const [usageCount] = await db
        .select({ cnt: count() })
        .from(workflowStepTemplate)
        .where(eq(workflowStepTemplate.workflowStatusId, params.id));

      if (usageCount && usageCount.cnt > 0) {
        set.status = 409;
        return {
          success: false,
          error: `Cannot delete: status is used by ${usageCount.cnt} workflow step(s)`,
        };
      }

      await db
        .delete(workflowStatus)
        .where(eq(workflowStatus.id, params.id));

      return { success: true };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
    }
  );
