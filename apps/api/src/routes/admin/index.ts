import { Elysia } from "elysia";
import { emailLogsRoute } from "./email-logs";
import {
  getEmailSettingsRoute,
  updateEmailSettingsRoute,
} from "./email-settings";

/**
 * Admin Routes
 * All routes require Admin role
 */
export const adminRoutes = new Elysia()
  .use(emailLogsRoute)
  .use(getEmailSettingsRoute)
  .use(updateEmailSettingsRoute);
