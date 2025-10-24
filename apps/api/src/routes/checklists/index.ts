import { Elysia } from "elysia";
import { listChecklistsRoute } from "./list";
import { createChecklistRoute } from "./create";
import { detailChecklistRoute } from "./detail";
import { updateChecklistRoute } from "./update";
import { deleteChecklistRoute } from "./delete";

/**
 * Document Checklist Template Management Routes
 * All routes are prefixed with /api/checklists
 *
 * Routes:
 * - GET    /api/checklists     - List all checklist templates in tenant
 * - POST   /api/checklists     - Create new checklist template (Admin)
 * - GET    /api/checklists/:id - Get checklist template by ID
 * - PUT    /api/checklists/:id - Update checklist template (Admin)
 * - DELETE /api/checklists/:id - Soft delete checklist template (Admin)
 */
export const checklistsRoutes = new Elysia({ prefix: "/api" })
  .use(listChecklistsRoute)
  .use(createChecklistRoute)
  .use(detailChecklistRoute)
  .use(updateChecklistRoute)
  .use(deleteChecklistRoute);
