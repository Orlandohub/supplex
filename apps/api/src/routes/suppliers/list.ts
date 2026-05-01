import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers } from "@supplex/db";
import {
  eq,
  and,
  isNull,
  or,
  ilike,
  inArray,
  asc,
  desc,
  sql,
} from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/suppliers
 * Returns paginated, filtered, and sorted list of suppliers
 *
 * Query params:
 * - search: Full-text search on name, tax_id, address (optional)
 * - status[]: Array of status enums to filter (multi-select, optional)
 * - category[]: Array of category enums to filter (multi-select, optional)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sort: Sort column and direction (e.g., 'name_asc', 'updated_at_desc')
 *
 * Auth: Requires valid JWT (any authenticated user can list suppliers)
 */
export const listSuppliersRoute = new Elysia({ prefix: "/suppliers" })
  .use(authenticatedRoute)
  .get(
    "/",
    async ({ query, user, requestLogger }) => {
      requestLogger.debug({}, "Supplier list handler invoked");
      requestLogger.debug({ user }, "Supplier list user context");
      try {
        const tenantId = user.tenantId;

        // TODO: Add Redis caching for performance optimization
        // Cache key: `suppliers:list:${tenantId}:${queryHash}`
        // TTL: 5 minutes
        // This will be implemented when Redis is configured
        const {
          search,
          status,
          category,
          page = 1,
          limit = 20,
          sort = "updated_at_desc",
        } = query;

        // Validate pagination parameters
        const pageNum = Math.max(1, page);
        const limitNum = Math.min(100, Math.max(1, limit));
        const offset = (pageNum - 1) * limitNum;

        // Parse sort parameter
        const [sortColumn, sortDirection] = sort.split("_") as [
          string,
          "asc" | "desc",
        ];

        // Build where conditions
        const conditions = [];

        // Tenant isolation (always required)
        conditions.push(eq(suppliers.tenantId, tenantId));

        // Exclude soft-deleted suppliers
        conditions.push(isNull(suppliers.deletedAt));

        // Search filter. Drizzle's `or()` returns `SQL | undefined`, but it
        // is only undefined when called with zero conditions; we always pass
        // three, so the result is always defined.
        if (search) {
          const searchCondition = or(
            ilike(suppliers.name, `%${search}%`),
            ilike(suppliers.taxId, `%${search}%`),
            sql`${suppliers.address}::text ILIKE ${`%${search}%`}`
          );
          if (searchCondition) {
            conditions.push(searchCondition);
          }
        }

        // Status filter
        if (status && status.length > 0) {
          conditions.push(inArray(suppliers.status, status));
        }

        // Category filter
        if (category && category.length > 0) {
          conditions.push(inArray(suppliers.category, category));
        }

        // Build order by clause
        let orderByClause;
        switch (sortColumn) {
          case "name":
            orderByClause =
              sortDirection === "asc"
                ? asc(suppliers.name)
                : desc(suppliers.name);
            break;
          case "status":
            orderByClause =
              sortDirection === "asc"
                ? asc(suppliers.status)
                : desc(suppliers.status);
            break;
          case "updated_at":
          default:
            orderByClause =
              sortDirection === "asc"
                ? asc(suppliers.updatedAt)
                : desc(suppliers.updatedAt);
            break;
        }

        // Fetch suppliers with pagination
        const suppliersList = await db
          .select()
          .from(suppliers)
          .where(and(...conditions))
          .orderBy(orderByClause)
          .limit(limitNum)
          .offset(offset);

        // Get total count for pagination
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(suppliers)
          .where(and(...conditions));
        const count = countResult[0]?.count ?? 0;

        return {
          success: true,
          data: {
            suppliers: suppliersList,
            total: count,
            page: pageNum,
            limit: limitNum,
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error fetching suppliers");
        throw Errors.internal("Failed to fetch suppliers");
      }
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        status: t.Optional(t.Array(t.String())),
        category: t.Optional(t.Array(t.String())),
        page: t.Optional(t.Numeric({ minimum: 1 })),
        // Cap is enforced below via `limitNum`; the schema intentionally allows
        // values > 100 so clients receive 200 + `limit: 100` instead of 422 when
        // they overshoot (see suppliers list acceptance tests).
        limit: t.Optional(t.Numeric({ minimum: 1 })),
        sort: t.Optional(t.String()),
      }),
      detail: {
        summary: "List suppliers in tenant",
        description:
          "Returns paginated, filtered, and sorted list of suppliers in the authenticated user's tenant",
        tags: ["Suppliers"],
      },
    }
  );
