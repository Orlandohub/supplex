import { Elysia } from "elysia";
import { listWorkflowTemplatesRoute } from "./list";
import { createWorkflowTemplateRoute } from "./create";
import { getWorkflowTemplateRoute } from "./get";
import { updateWorkflowTemplateRoute } from "./update";
import { deleteWorkflowTemplateRoute } from "./delete";
import { copyWorkflowTemplate } from "./copy";
import { toggleActiveWorkflowTemplateRoute } from "./toggle-active";
import { publishWorkflowTemplateRoute } from "./publish";
import { listStepsRoute } from "./steps/list";
import { createStepRoute } from "./steps/create";
import { updateStepRoute } from "./steps/update";
import { deleteStepRoute } from "./steps/delete";
import { reorderStepsRoute } from "./steps/reorder";

/**
 * Workflow Templates Route Aggregator
 * 
 * Registers all workflow template management routes with /api/workflow-templates prefix
 * 
 * CRITICAL: Following ElysiaJS route organization pattern:
 * - ONLY this parent aggregator has a prefix
 * - Child routes must NOT have prefixes (parent provides them)
 * 
 * Routes:
 * Template Management:
 * - GET    /api/workflow-templates                           - List templates
 * - POST   /api/workflow-templates                           - Create template
 * - GET    /api/workflow-templates/:workflowId               - Get template by ID
 * - POST   /api/workflow-templates/:workflowId/copy          - Copy template (deep copy)
 * - PUT    /api/workflow-templates/:workflowId               - Update template metadata
 * - PATCH  /api/workflow-templates/:templateId/publish       - Toggle publish status (Admin only)
 * - PATCH  /api/workflow-templates/:templateId/toggle-active - Toggle active status (Admin only)
 * - DELETE /api/workflow-templates/:workflowId               - Delete template
 * 
 * Step Management:
 * - GET    /api/workflow-templates/:workflowId/steps        - Get ordered steps
 * - POST   /api/workflow-templates/:workflowId/steps        - Create step
 * - PUT    /api/workflow-templates/:workflowId/steps/:stepId - Update step
 * - DELETE /api/workflow-templates/:workflowId/steps/:stepId - Delete step
 * - PUT    /api/workflow-templates/:workflowId/steps/reorder - Reorder steps
 */
export const workflowTemplatesRoutes = new Elysia({
  prefix: "/api/workflow-templates",
})
  // Template base routes
  .use(listWorkflowTemplatesRoute)
  .use(createWorkflowTemplateRoute)
  .use(getWorkflowTemplateRoute)
  .use(copyWorkflowTemplate)
  .use(updateWorkflowTemplateRoute)
  .use(publishWorkflowTemplateRoute)
  .use(toggleActiveWorkflowTemplateRoute)
  .use(deleteWorkflowTemplateRoute)
  // Step routes
  .use(listStepsRoute)
  .use(createStepRoute)
  .use(updateStepRoute)
  .use(deleteStepRoute)
  .use(reorderStepsRoute)
;


