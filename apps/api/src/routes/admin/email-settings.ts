import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { tenants } from "@supplex/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../lib/rbac/middleware";

/**
 * GET /api/admin/email-settings
 * Get tenant email notification settings
 *
 * Auth: Requires Admin role
 */
export const getEmailSettingsRoute = new Elysia({ prefix: "/admin" })
  .use(requireAdmin)
  .get(
    "/email-settings",
    async ({ user, set }: any) => {
      try {
        const tenantId = user.tenantId as string;

        // Fetch tenant
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, tenantId),
        });

        if (!tenant) {
          set.status = 404;
          return {
            success: false,
            error: "Tenant not found",
          };
        }

        // Extract email notification settings
        const tenantSettings = tenant.settings as Record<
          string,
          unknown
        > | null;
        const emailSettings = tenantSettings?.emailNotifications as
          | Record<string, boolean>
          | undefined;

        // Default all to true if not set
        const settings = {
          workflowSubmitted: emailSettings?.workflowSubmitted ?? true,
          stageApproved: emailSettings?.stageApproved ?? true,
          stageRejected: emailSettings?.stageRejected ?? true,
          stageAdvanced: emailSettings?.stageAdvanced ?? true,
          workflowApproved: emailSettings?.workflowApproved ?? true,
        };

        return {
          success: true,
          data: settings,
        };
      } catch (error: any) {
        console.error("Error fetching email settings:", error);
        set.status = 500;
        return {
          success: false,
          error: "Internal server error",
        };
      }
    },
    {
      detail: {
        summary: "Get tenant email settings",
        description:
          "Retrieve tenant-wide email notification settings (Admin only)",
        tags: ["Admin", "Email"],
      },
    }
  );

/**
 * PUT /api/admin/email-settings
 * Update tenant email notification settings
 *
 * Body: Email notification settings object
 *
 * Auth: Requires Admin role
 */
export const updateEmailSettingsRoute = new Elysia({ prefix: "/admin" })
  .use(requireAdmin)
  .put(
    "/email-settings",
    async ({ body, user, set }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const {
          workflowSubmitted,
          stageApproved,
          stageRejected,
          stageAdvanced,
          workflowApproved,
        } = body;

        // Fetch current tenant settings
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, tenantId),
        });

        if (!tenant) {
          set.status = 404;
          return {
            success: false,
            error: "Tenant not found",
          };
        }

        // Merge email notification settings into tenant settings
        const currentSettings =
          (tenant.settings as Record<string, unknown>) || {};
        const updatedSettings = {
          ...currentSettings,
          emailNotifications: {
            workflowSubmitted,
            stageApproved,
            stageRejected,
            stageAdvanced,
            workflowApproved,
          },
        };

        // Update tenant settings
        const [updatedTenant] = await db
          .update(tenants)
          .set({
            settings: updatedSettings,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenantId))
          .returning();

        if (!updatedTenant) {
          throw new Error("Failed to update tenant settings");
        }

        return {
          success: true,
          data: {
            workflowSubmitted,
            stageApproved,
            stageRejected,
            stageAdvanced,
            workflowApproved,
          },
          message: "Email settings updated successfully",
        };
      } catch (error: any) {
        console.error("Error updating email settings:", error);
        set.status = 500;
        return {
          success: false,
          error: "Internal server error",
        };
      }
    },
    {
      body: t.Object({
        workflowSubmitted: t.Boolean(),
        stageApproved: t.Boolean(),
        stageRejected: t.Boolean(),
        stageAdvanced: t.Boolean(),
        workflowApproved: t.Boolean(),
      }),
      detail: {
        summary: "Update tenant email settings",
        description:
          "Update tenant-wide email notification settings (Admin only)",
        tags: ["Admin", "Email"],
      },
    }
  );
