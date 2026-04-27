import { Elysia, t } from "elysia";
import { db } from "../lib/db";
import { userNotificationPreferences } from "@supplex/db";
import { eq, and } from "drizzle-orm";
import * as jwt from "jsonwebtoken";
import { EmailEventType } from "@supplex/types";
import { correlationId } from "../lib/correlation-id";

/**
 * Narrow shape of the unsubscribe JWT payload signed by the email service.
 * Only `userId` and `eventType` are required for unsubscribe — everything
 * else is treated as untrusted metadata.
 */
interface UnsubscribePayload {
  userId?: unknown;
  eventType?: unknown;
}

/**
 * GET /api/unsubscribe/:token
 * Unsubscribe user from email notifications via token
 *
 * Public route - no authentication required
 * Token contains userId and eventType
 */
export const unsubscribeRoute = new Elysia({ prefix: "/api" })
  .use(correlationId)
  .get(
    "/unsubscribe/:token",
    async ({ params, set, requestLogger }) => {
      try {
        const { token } = params;

        // Verify and decode token
        const secret =
          process.env.UNSUBSCRIBE_JWT_SECRET ||
          process.env.JWT_SECRET ||
          "dev-secret";
        let decoded: UnsubscribePayload;

        try {
          // jwt.verify returns `string | JwtPayload`; narrow to object payload.
          const verified = jwt.verify(token, secret);
          decoded =
            typeof verified === "object" && verified !== null
              ? (verified as UnsubscribePayload)
              : {};
        } catch (error) {
          set.status = 400;
          set.headers["content-type"] = "text/html; charset=utf-8";
          return `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invalid Unsubscribe Link</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 40px;
                  border-radius: 10px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                  max-width: 500px;
                  text-align: center;
                }
                h1 { color: #dc3545; margin-bottom: 20px; }
                p { color: #666; line-height: 1.6; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>⚠️ Invalid Unsubscribe Link</h1>
                <p>This unsubscribe link is invalid or has expired. Please contact support if you continue to receive unwanted emails.</p>
              </div>
            </body>
          </html>
        `;
        }

        const userId =
          typeof decoded.userId === "string" ? decoded.userId : null;
        const eventType =
          typeof decoded.eventType === "string" ? decoded.eventType : null;

        if (!userId || !eventType) {
          set.status = 400;
          set.headers["content-type"] = "text/html; charset=utf-8";
          return `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invalid Token</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 40px;
                  border-radius: 10px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                  max-width: 500px;
                  text-align: center;
                }
                h1 { color: #dc3545; margin-bottom: 20px; }
                p { color: #666; line-height: 1.6; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>⚠️ Invalid Token</h1>
                <p>The unsubscribe token is missing required information. Please contact support.</p>
              </div>
            </body>
          </html>
        `;
        }

        // Get user to determine tenant
        const user = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.id, userId),
        });

        if (!user) {
          set.status = 404;
          set.headers["content-type"] = "text/html; charset=utf-8";
          return `
          <!DOCTYPE html>
          <html>
            <head>
              <title>User Not Found</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                  background: white;
                  padding: 40px;
                  border-radius: 10px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                  max-width: 500px;
                  text-align: center;
                }
                h1 { color: #dc3545; margin-bottom: 20px; }
                p { color: #666; line-height: 1.6; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>⚠️ User Not Found</h1>
                <p>We couldn't find your user account. Please contact support.</p>
              </div>
            </body>
          </html>
        `;
        }

        // Check if preference already exists
        const existingPref =
          await db.query.userNotificationPreferences.findFirst({
            where: and(
              eq(userNotificationPreferences.userId, userId),
              eq(userNotificationPreferences.eventType, eventType)
            ),
          });

        if (existingPref) {
          // Update existing preference
          await db
            .update(userNotificationPreferences)
            .set({
              emailEnabled: false,
              unsubscribedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(userNotificationPreferences.id, existingPref.id));
        } else {
          // Create new preference
          await db.insert(userNotificationPreferences).values({
            userId,
            tenantId: user.tenantId,
            eventType,
            emailEnabled: false,
            unsubscribedAt: new Date(),
          });
        }

        // Map event type to friendly name
        const eventNames: Record<string, string> = {
          [EmailEventType.WORKFLOW_SUBMITTED]: "Workflow Submitted",
          [EmailEventType.STAGE_APPROVED]: "Stage Approved",
          [EmailEventType.STAGE_REJECTED]: "Stage Rejected",
          [EmailEventType.STAGE_ADVANCED]: "Stage Advanced",
          [EmailEventType.WORKFLOW_APPROVED]: "Workflow Approved",
        };

        const eventName = eventNames[eventType] || eventType;

        set.headers["content-type"] = "text/html; charset=utf-8";
        return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Unsubscribed Successfully</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                max-width: 500px;
                text-align: center;
              }
              h1 { color: #28a745; margin-bottom: 20px; }
              p { color: #666; line-height: 1.6; margin-bottom: 15px; }
              .event-name {
                background: #f8f9fa;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: 600;
                color: #333;
                margin: 20px 0;
              }
              .info {
                font-size: 14px;
                color: #999;
                margin-top: 30px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✓ Unsubscribed Successfully</h1>
              <p>You have been unsubscribed from:</p>
              <div class="event-name">${eventName}</div>
              <p>You will no longer receive emails for this notification type.</p>
              <p class="info">You can manage your notification preferences by logging into your Supplex account.</p>
            </div>
          </body>
        </html>
      `;
      } catch (error: unknown) {
        requestLogger.error({ err: error }, "Unsubscribe processing failed");
        set.status = 500;
        set.headers["content-type"] = "text/html; charset=utf-8";
        return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                max-width: 500px;
                text-align: center;
              }
              h1 { color: #dc3545; margin-bottom: 20px; }
              p { color: #666; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⚠️ Error</h1>
              <p>An error occurred while processing your unsubscribe request. Please try again later or contact support.</p>
            </div>
          </body>
        </html>
      `;
      }
    },
    {
      params: t.Object({
        token: t.String(),
      }),
      detail: {
        summary: "Unsubscribe from email notifications",
        description:
          "Public endpoint to unsubscribe from specific email notification types",
        tags: ["Email", "Public"],
      },
    }
  );
