import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { users, userInvitations, suppliers } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireRole } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { UserRole } from "@supplex/types";
import { Errors } from "../../lib/errors";

/**
 * GET /api/users/pending-invitations
 * List all users with pending invitations
 *
 * Auth: Requires Admin role
 * Tenant Scoping: Automatically filtered by user's tenant_id
 * Query Params:
 *   - role (optional): Filter by user role (e.g., "supplier_user")
 * Returns: Array of pending invitations with supplier context
 */
export const pendingInvitationsRoute = new Elysia({ prefix: "/users" })
  .use(authenticatedRoute)
  .use(requireRole([UserRole.ADMIN]))
  .get(
    "/pending-invitations",
    async ({ user, query, set, requestLogger }) => {
      try {
        const tenantId = user.tenantId;
        const roleFilter = query.role as string | undefined;

        // Build where conditions
        const whereConditions = [
          eq(users.tenantId, tenantId),
          eq(users.status, "pending_activation"),
        ];

        // Add role filter if provided
        if (roleFilter) {
          whereConditions.push(eq(users.role, roleFilter));
        }

        // Query users with status pending_activation and their invitations
        const pendingUsers = await db
          .select({
            userId: users.id,
            userName: users.fullName,
            userEmail: users.email,
            userRole: users.role,
            userStatus: users.status,
            invitationId: userInvitations.id,
            invitationToken: userInvitations.token,
            expiresAt: userInvitations.expiresAt,
            usedAt: userInvitations.usedAt,
            createdAt: userInvitations.createdAt,
          })
          .from(users)
          .leftJoin(
            userInvitations,
            and(
              eq(userInvitations.userId, users.id),
              isNull(userInvitations.usedAt) // Only non-used invitations
            )
          )
          .where(and(...whereConditions));

        // For each user, find their associated supplier (if any)
        const enrichedResults = await Promise.all(
          pendingUsers.map(async (pendingUser) => {
            // Find supplier where this user is the supplier_user
            const supplier = await db.query.suppliers.findFirst({
              where: and(
                eq(suppliers.supplierUserId, pendingUser.userId),
                eq(suppliers.tenantId, tenantId),
                isNull(suppliers.deletedAt)
              ),
              columns: {
                id: true,
                name: true,
              },
            });

            // Calculate invitation status
            let invitationStatus: "pending" | "expired" | null = null;
            if (pendingUser.invitationId) {
              if (pendingUser.usedAt) {
                // Skip used invitations (shouldn't happen due to query filter, but defensive)
                return null;
              }
              invitationStatus =
                new Date(pendingUser.expiresAt!) < new Date()
                  ? "expired"
                  : "pending";
            }

            // Only return if there's an active (unused) invitation
            if (!pendingUser.invitationId) {
              return null;
            }

            return {
              userId: pendingUser.userId,
              userName: pendingUser.userName,
              userEmail: pendingUser.userEmail,
              userRole: pendingUser.userRole,
              supplierName: supplier?.name || null,
              supplierId: supplier?.id || null,
              invitationId: pendingUser.invitationId,
              invitationToken: pendingUser.invitationToken,
              invitationStatus,
              expiresAt: pendingUser.expiresAt,
              createdAt: pendingUser.createdAt,
            };
          })
        );

        // Filter out null results (used invitations or missing invitations)
        const validResults = enrichedResults.filter((r) => r !== null);

        set.status = 200;
        return {
          success: true,
          data: validResults,
        };
      } catch (error: unknown) {
        requestLogger.error(
          { err: error },
          "Error fetching pending invitations"
        );
        throw Errors.internal("Failed to fetch pending invitations");
      }
    },
    {
      query: t.Object({
        role: t.Optional(t.String()),
      }),
      detail: {
        summary: "List pending invitations",
        description:
          "Get all users with pending invitations, optionally filtered by role",
        tags: ["Users"],
      },
    }
  );
