import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { emailNotifications } from "@supplex/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { AuthContext } from "../../lib/rbac/middleware";
import { Errors } from "../../lib/errors";

/**
 * GET /api/admin/email-logs
 * Lists email notification logs with filtering and pagination
 *
 * Query Params:
 * - status: Filter by email status (optional)
 * - startDate: Filter by start date (optional)
 * - endDate: Filter by end date (optional)
 * - userId: Filter by user ID (optional)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 100)
 *
 * Auth: Requires Admin role
 */
export const emailLogsRoute = new Elysia()
  .get(
    "/email-logs",
    async ({ query, user, set, requestLogger }: any) => {
      try {
        const tenantId = user.tenantId as string;
        const {
          status,
          startDate,
          endDate,
          userId,
          page = "1",
          limit = "50",
        } = query;

        // Parse pagination params
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;

        // Build WHERE conditions
        const conditions: any[] = [eq(emailNotifications.tenantId, tenantId)];

        if (status) {
          conditions.push(eq(emailNotifications.status, status));
        }

        if (userId) {
          conditions.push(eq(emailNotifications.userId, userId));
        }

        if (startDate) {
          const startDateTime = new Date(startDate);
          if (!isNaN(startDateTime.getTime())) {
            conditions.push(gte(emailNotifications.createdAt, startDateTime));
          }
        }

        if (endDate) {
          const endDateTime = new Date(endDate);
          if (!isNaN(endDateTime.getTime())) {
            // Set to end of day
            endDateTime.setHours(23, 59, 59, 999);
            conditions.push(lte(emailNotifications.createdAt, endDateTime));
          }
        }

        // If no date filters, default to last 30 days
        if (!startDate && !endDate) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          conditions.push(gte(emailNotifications.createdAt, thirtyDaysAgo));
        }

        // Fetch email logs
        const logs = await db
          .select()
          .from(emailNotifications)
          .where(and(...conditions))
          .orderBy(desc(emailNotifications.createdAt))
          .limit(limitNum)
          .offset(offset);

        // Count total for pagination
        const [{ count }] = await db
          .select({ count: emailNotifications.id })
          .from(emailNotifications)
          .where(and(...conditions));

        const totalCount = typeof count === "number" ? count : logs.length;
        const totalPages = Math.ceil(totalCount / limitNum);

        return {
          success: true,
          data: {
            logs: logs.map((log) => ({
              id: log.id,
              eventType: log.eventType,
              recipientEmail: log.recipientEmail,
              subject: log.subject,
              status: log.status,
              attemptCount: log.attemptCount,
              sentAt: log.sentAt?.toISOString() || null,
              failedReason: log.failedReason,
              createdAt: log.createdAt.toISOString(),
            })),
            pagination: {
              page: pageNum,
              limit: limitNum,
              totalCount,
              totalPages,
              hasMore: pageNum < totalPages,
            },
          },
        };
      } catch (error: any) {
        requestLogger.error({ err: error }, "Email logs fetch failed");
        throw Errors.internal("Internal server error");
      }
    },
    {
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("pending"),
            t.Literal("sent"),
            t.Literal("failed"),
            t.Literal("bounced"),
          ])
        ),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        userId: t.Optional(t.String({ format: "uuid" })),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        summary: "List email notification logs",
        description:
          "Retrieve email logs with filtering and pagination (Admin only)",
        tags: ["Admin", "Email"],
      },
    }
  );
