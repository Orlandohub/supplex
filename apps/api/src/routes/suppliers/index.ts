import { Elysia } from "elysia";
import { listSuppliersRoute } from "./list";
import { supplierDetailRoutes } from "./detail";
import { createSupplierRoute } from "./create";
import { updateSupplierRoute } from "./update";

/**
 * Supplier Management Routes
 * All routes are prefixed with /api/suppliers
 *
 * Routes:
 * - GET    /api/suppliers           - List all suppliers in tenant (paginated, filterable, searchable)
 * - POST   /api/suppliers           - Create new supplier (Admin/Procurement Manager)
 * - GET    /api/suppliers/:id       - Get detailed supplier information by ID
 * - PUT    /api/suppliers/:id       - Update supplier (Admin/Procurement Manager)
 * - PATCH  /api/suppliers/:id/status - Update supplier status (Admin/Procurement Manager)
 * - DELETE /api/suppliers/:id       - Soft delete supplier (Admin only)
 */
export const suppliersRoutes = new Elysia({ prefix: "/api" })
  .use(listSuppliersRoute)
  .use(createSupplierRoute)
  .use(updateSupplierRoute)
  .use(supplierDetailRoutes);
