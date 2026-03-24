import { Elysia } from "elysia";
import { listDocumentTemplatesRoute } from "./list";
import { getPublishedDocumentTemplatesRoute } from "./get-published";
import { createDocumentTemplateRoute } from "./create";
import { updateDocumentTemplateRoute } from "./update";
import { deleteDocumentTemplateRoute } from "./delete";

/**
 * Document Templates Route Aggregator
 * 
 * Registers all document template management routes with /api/document-templates prefix
 * 
 * CRITICAL: Following ElysiaJS route organization pattern:
 * - ONLY this parent aggregator has a prefix
 * - Child routes must NOT have prefixes (parent provides them)
 * 
 * Routes:
 * - GET    /api/document-templates           - List templates (admin only)
 * - GET    /api/document-templates/published - Get published templates for workflow builder dropdown
 * - POST   /api/document-templates           - Create template (admin only)
 * - PUT    /api/document-templates/:id       - Update template (admin only)
 * - DELETE /api/document-templates/:id       - Delete template (admin only, fails if in use)
 */
export const documentTemplatesRoutes = new Elysia({ prefix: "/api/document-templates" })
  .use(listDocumentTemplatesRoute)
  .use(getPublishedDocumentTemplatesRoute)
  .use(createDocumentTemplateRoute)
  .use(updateDocumentTemplateRoute)
  .use(deleteDocumentTemplateRoute);

