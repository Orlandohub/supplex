/**
 * Get Supplier By User ID Endpoint
 * Returns the supplier associated with a specific user (for supplier_user role)
 */

import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";

export default new Elysia()
  .use(authenticate)
  .get(
    "",
    async ({ params, user, set }) => {
      const { userId } = params;

      if (!user) {
        set.status = 401;
        return {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Query for supplier where supplierUserId matches the provided userId
      // Include tenant isolation
      const supplier = await db.query.suppliers.findFirst({
        where: and(
          eq(suppliers.supplierUserId, userId),
          eq(suppliers.tenantId, user.tenantId)
        ),
        columns: {
          id: true,
          name: true,
          status: true,
          supplierUserId: true,
        },
      });

      if (!supplier) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "SUPPLIER_NOT_FOUND",
            message: "No supplier associated with this user",
            timestamp: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: supplier,
      };
    },
    {
      params: t.Object({
        userId: t.String({
          description: "User ID to find associated supplier",
        }),
      }),
      detail: {
        tags: ["Suppliers"],
        summary: "Get supplier by user ID",
        description:
          "Returns the supplier associated with a specific user (for supplier_user role)",
      },
    }
  );

