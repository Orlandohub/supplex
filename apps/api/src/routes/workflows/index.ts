import { Elysia } from "elysia";
import { initiateWorkflowRoute } from "./initiate";
import { supplierWorkflowsRoute } from "./supplier-workflows";

/**
 * Workflow Routes
 * Aggregates all workflow-related API endpoints
 *
 * Routes:
 * - POST /api/workflows/initiate - Initiate a new qualification workflow
 * - GET /api/workflows/supplier/:supplierId - Get workflows for a supplier
 */
export const workflowsRoutes = new Elysia({ prefix: "/workflows" })
  .use(initiateWorkflowRoute)
  .use(supplierWorkflowsRoute);
