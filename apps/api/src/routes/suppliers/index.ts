import { Elysia } from "elysia";
import { listSuppliersRoute } from "./list";

/**
 * Supplier Management Routes
 * All routes are prefixed with /api/suppliers
 *
 * Routes:
 * - GET    /api/suppliers           - List all suppliers in tenant (paginated, filterable, searchable)
 */
export const suppliersRoutes = new Elysia({ prefix: "/api" })
  .use(listSuppliersRoute);

