import { Elysia } from "elysia";
import { instantiateRoute } from "./instantiate";
import { getProcessRoute } from "./processes/get";
import { listProcessesRoute } from "./processes/list";
import { sendReminderRoute } from "./processes/send-reminder";
import { getStepRoute } from "./steps/get";
import { completeStepRoute } from "./steps/complete";
import { stepDocumentsRoutes } from "./steps/documents/index";
import { createCommentRoute } from "./comments/create";
import { getCommentsByStepRoute } from "./comments/get-by-step";
import { myTasksRoute } from "./my-tasks";
import { myTasksCountRoute } from "./my-tasks-count";
import { supplierProcessesRoute } from "./supplier-processes";
import { getProcessEventsRoute } from "./processes/events";
import { auditLogRoute } from "./audit-log";

/**
 * Workflow Routes
 * New Workflow Engine API endpoints
 *
 * Routes:
 * - POST /api/workflows/instantiate - Instantiate a workflow from template
 * - GET /api/workflows/processes - List all workflow processes for tenant (paginated)
 * - GET /api/workflows/processes/:id - Get process details
 * - POST /api/workflows/processes/:id/send-reminder - Send reminder to supplier assignee
 * - GET /api/workflows/steps/:id - Get step details
 * - POST /api/workflows/steps/:id/complete - Complete a step (submit/approve/decline)
 * - GET /api/workflows/steps/:id/comments - Get step comments
 * - POST /api/workflows/steps/:id/comments - Create comment on step
 * - GET /api/workflows/my-tasks - Get tasks for current user
 * - GET /api/workflows/my-tasks/count - Get task count for badge
 * - GET /api/workflows/supplier/:supplierId/processes - Get all processes for a supplier
 */
export const workflowsRoutes = new Elysia({ prefix: "/api/workflows" })
  .use(instantiateRoute)
  .use(listProcessesRoute)
  .use(sendReminderRoute)
  .use(myTasksCountRoute)
  .use(myTasksRoute)
  .use(supplierProcessesRoute)
  .use(getProcessRoute)
  .use(getStepRoute)
  .use(completeStepRoute)
  .use(stepDocumentsRoutes)
  .use(createCommentRoute)
  .use(getCommentsByStepRoute)
  .use(getProcessEventsRoute)
  .use(auditLogRoute);
