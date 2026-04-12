import { Elysia } from "elysia";
import { emailLogsRoute } from "./email-logs";
import {
  getEmailSettingsRoute,
  updateEmailSettingsRoute,
} from "./email-settings";
import { supplierStatusRoutes } from "./supplier-statuses";
import { workflowTypeRoutes } from "./workflow-types";
import { workflowHealthRoute } from "./workflow-health";
import { requireAdmin } from "../../lib/rbac/middleware";

/**
 * Admin Routes
 * All routes in this group require Admin role via `requireAdmin` middleware.
 * Routes are prefixed with /api/admin
 */
export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(requireAdmin)
  .use(emailLogsRoute)
  .use(getEmailSettingsRoute)
  .use(updateEmailSettingsRoute)
  .use(supplierStatusRoutes)
  .use(workflowTypeRoutes)
  .use(workflowHealthRoute);
