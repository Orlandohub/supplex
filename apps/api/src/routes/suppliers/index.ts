import { Elysia } from "elysia";
import { listSuppliersRoute } from "./list";
import { supplierDetailRoutes } from "./detail";
import { createSupplierRoute } from "./create";
import { updateSupplierRoute } from "./update";
import { updateContactRoute } from "./update-contact";
import { addContactRoute } from "./add-contact";
import byUser from "./by-user";

/**
 * Supplier Management Routes
 * All routes are prefixed with /api/suppliers
 *
 * Routes:
 * - GET    /api/suppliers           - List all suppliers in tenant (paginated, filterable, searchable)
 * - POST   /api/suppliers           - Create new supplier (Admin/Procurement Manager)
 * - GET    /api/suppliers/by-user/:userId - Get supplier associated with a user ID
 * - GET    /api/suppliers/:id       - Get detailed supplier information by ID
 * - PUT    /api/suppliers/:id       - Update supplier (Admin/Procurement Manager)
 * - PATCH  /api/suppliers/:id/status - Update supplier status (Admin/Procurement Manager)
 * - POST   /api/suppliers/:id/contact - Add contact user to supplier (Admin/Procurement Manager)
 * - PATCH  /api/suppliers/:id/contact - Update supplier contact user (Admin/Procurement Manager)
 * - DELETE /api/suppliers/:id       - Soft delete supplier (Admin only)
 */
export const suppliersRoutes = new Elysia({ prefix: "/api" })
  .use(listSuppliersRoute)
  .use(createSupplierRoute)
  .use(updateSupplierRoute)
  .use(updateContactRoute)
  .use(addContactRoute)
  .group("/suppliers/by-user/:userId", (app) => app.use(byUser))
  .use(supplierDetailRoutes);
