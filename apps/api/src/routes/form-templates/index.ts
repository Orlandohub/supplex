import { Elysia } from "elysia";
import { listFormTemplatesRoute } from "./list";
import { getFormTemplateRoute } from "./get";
import { getPublishedFormTemplatesRoute } from "./get-published-by-tenant";
import { createFormTemplateRoute } from "./create";
import { updateFormTemplateRoute } from "./update";
import { deleteFormTemplateRoute } from "./delete";
import { copyFormTemplate } from "./copy";
import { createSectionRoute } from "./sections/create";
import { updateSectionRoute } from "./sections/update";
import { deleteSectionRoute } from "./sections/delete";
import { reorderSectionsRoute } from "./sections/reorder";
import { createFieldRoute } from "./fields/create";
import { updateFieldRoute } from "./fields/update";
import { deleteFieldRoute } from "./fields/delete";
import { reorderFieldsRoute } from "./fields/reorder";
import { publishVersionRoute } from "./publish";

/**
 * Form Templates Route Aggregator
 * 
 * Registers all form template management routes with /api/form-templates prefix
 * 
 * CRITICAL: Following ElysiaJS route organization pattern:
 * - ONLY this parent aggregator has a prefix
 * - Child routes must NOT have prefixes (parent provides them)
 * 
 * Routes:
 * Template Management:
 * - GET    /api/form-templates           - List templates
 * - GET    /api/form-templates/published - Get published templates for dropdown
 * - GET    /api/form-templates/:id       - Get template by ID
 * - POST   /api/form-templates           - Create template
 * - POST   /api/form-templates/:id/copy  - Copy template (deep copy)
 * - PATCH  /api/form-templates/:id       - Update template
 * - DELETE /api/form-templates/:id       - Delete template
 * 
 * Section Management:
 * - POST   /api/form-templates/:templateId/sections           - Create section
 * - PATCH  /api/form-templates/sections/:sectionId            - Update section
 * - DELETE /api/form-templates/sections/:sectionId            - Delete section
 * - POST   /api/form-templates/:templateId/sections/reorder   - Reorder sections
 * 
 * Field Management:
 * - POST   /api/form-templates/sections/:sectionId/fields         - Create field
 * - PATCH  /api/form-templates/fields/:fieldId                    - Update field
 * - DELETE /api/form-templates/fields/:fieldId                    - Delete field
 * - POST   /api/form-templates/sections/:sectionId/fields/reorder - Reorder fields
 * 
 * Publishing:
 * - PATCH  /api/form-templates/:id/publish - Publish template (status toggle)
 */
export const formTemplatesRoutes = new Elysia({ prefix: "/api/form-templates" })
  .use(listFormTemplatesRoute)
  .use(getPublishedFormTemplatesRoute)
  .use(getFormTemplateRoute)
  .use(createFormTemplateRoute)
  .use(copyFormTemplate)
  .use(updateFormTemplateRoute)
  .use(deleteFormTemplateRoute)
  .use(createSectionRoute)
  .use(updateSectionRoute)
  .use(deleteSectionRoute)
  .use(reorderSectionsRoute)
  .use(createFieldRoute)
  .use(updateFieldRoute)
  .use(deleteFieldRoute)
  .use(reorderFieldsRoute)
  .use(publishVersionRoute);

