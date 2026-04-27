import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { tenants } from "@supplex/db";
import { eq } from "drizzle-orm";
import { ApiError, Errors } from "../../lib/errors";
import { authenticatedRoute } from "../../lib/route-plugins";

/**
 * GET /api/admin/email-settings
 * Get tenant email notification settings
 *
 * Auth: Requires Admin role
 */
export const getEmailSettingsRoute = new Elysia().use(authenticatedRoute).get(
  "/email-settings",
  async ({ user, requestLogger }) => {
    try {
      const tenantId = user.tenantId;

      // Fetch tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw Errors.notFound("Tenant not found");
      }

      // Extract email notification settings
      const tenantSettings = tenant.settings as Record<string, unknown> | null;
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
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      requestLogger.error({ err: error }, "Email settings fetch failed");
      throw Errors.internal("Internal server error");
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
export const updateEmailSettingsRoute = new Elysia()
  .use(authenticatedRoute)
  .put(
    "/email-settings",
    async ({ body, user, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
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
          throw Errors.notFound("Tenant not found");
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
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Email settings update failed");
        throw Errors.internal("Internal server error");
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
