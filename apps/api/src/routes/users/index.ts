import { Elysia } from "elysia";
import { listUsersRoute } from "./list";
import { inviteUserRoute } from "./invite";
import { updateRoleRoute } from "./update-role";
import { deactivateUserRoute } from "./deactivate";
import { auditLogRoute } from "./audit-log";
import {
  getNotificationPreferencesRoute,
  updateNotificationPreferencesRoute,
} from "./notification-preferences";

/**
 * User Management Routes
 * All routes are prefixed with /api/users
 *
 * Routes:
 * - GET    /api/users           - List all users in tenant
 * - POST   /api/users/invite    - Invite new user with role
 * - PATCH  /api/users/:id/role  - Update user role
 * - PATCH  /api/users/:id/status - Deactivate/reactivate user
 * - GET    /api/users/:id/audit - Get user audit log
 * - GET    /api/users/me/notification-preferences - Get user notification preferences
 * - PUT    /api/users/me/notification-preferences - Update user notification preferences
 */
export const usersRoutes = new Elysia({ prefix: "/api" })
  .use(listUsersRoute)
  .use(inviteUserRoute)
  .use(updateRoleRoute)
  .use(deactivateUserRoute)
  .use(auditLogRoute)
  .use(getNotificationPreferencesRoute)
  .use(updateNotificationPreferencesRoute);
