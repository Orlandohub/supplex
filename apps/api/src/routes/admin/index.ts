import { Elysia } from "elysia";
import { emailLogsRoute } from "./email-logs";
import {
  getEmailSettingsRoute,
  updateEmailSettingsRoute,
} from "./email-settings";
import { supplierStatusRoutes } from "./supplier-statuses";
import { workflowStatusRoutes } from "./workflow-statuses";
import { workflowTypeRoutes } from "./workflow-types";

/**
 * Admin Routes
 * All routes require Admin role
 * Routes are prefixed with /api/admin
 */
export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(emailLogsRoute)
  .use(getEmailSettingsRoute)
  .use(updateEmailSettingsRoute)
  .use(supplierStatusRoutes)
  .use(workflowStatusRoutes)
  .use(workflowTypeRoutes);
