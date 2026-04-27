import { Elysia, t } from "elysia";
import { supabaseAdmin } from "../../lib/supabase";
import { db } from "../../lib/db";
import { tenants, users } from "@supplex/db";
import { eq } from "drizzle-orm";
import { authRateLimit } from "../../lib/rate-limiter";
import { correlationId } from "../../lib/correlation-id";
import type { InsertUser, InsertTenant } from "@supplex/types";
import {
  UserRole,
  TenantStatus,
  TenantPlan,
  createUserAuthMetadata,
  createUserProfileMetadata,
} from "@supplex/types";
import { ApiError, Errors } from "../../lib/errors";

// Validation schemas
const registerSchema = t.Object({
  email: t.String({
    format: "email",
    minLength: 1,
    maxLength: 255,
  }),
  password: t.String({
    minLength: 8,
    maxLength: 100,
  }),
  fullName: t.String({
    minLength: 1,
    maxLength: 200,
  }),
  tenantName: t.String({
    minLength: 2,
    maxLength: 100,
  }),
});

// Helper function to generate URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

// Helper function to ensure unique slug
async function generateUniqueSlug(baseName: string): Promise<string> {
  const baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export const registerRoute = new Elysia({ prefix: "/auth" })
  .use(correlationId)
  .use(authRateLimit)
  .post(
    "/register",
    async ({ body, set, requestLogger }) => {
      try {
        const { email, password, fullName, tenantName } = body;

        // Step 1: Create Supabase auth user
        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email for MVP (enables immediate sign-in)
            user_metadata: {
              full_name: fullName,
              tenant_name: tenantName,
            },
          });

        if (authError || !authUser.user) {
          if (authError) {
            requestLogger.error({ err: authError }, "Supabase auth error");
          } else {
            requestLogger.error(
              "Supabase auth user missing from createUser response"
            );
          }
          throw Errors.badRequest(
            authError?.message || "Failed to create user account"
          );
        }

        const userId = authUser.user.id;

        try {
          // Step 2: Create tenant record
          const uniqueSlug = await generateUniqueSlug(tenantName);

          const newTenant: InsertTenant = {
            name: tenantName,
            slug: uniqueSlug,
            settings: {},
            status: TenantStatus.ACTIVE,
            plan: TenantPlan.STARTER,
            subscriptionEndsAt: null,
          };

          const [tenant] = await db
            .insert(tenants)
            .values(newTenant)
            .returning();

          if (!tenant) {
            throw new Error("Failed to create tenant record");
          }

          // Step 3: Create user record with admin role
          const newUser: InsertUser = {
            id: userId, // Match Supabase auth user ID
            tenantId: tenant.id,
            email,
            fullName,
            role: UserRole.ADMIN,
            avatarUrl: null,
            isActive: true,
            lastLoginAt: null,
          };

          const [user] = await db.insert(users).values(newUser).returning();

          if (!user) {
            throw new Error("Failed to create user record");
          }

          // Step 4: Update Supabase Auth metadata with role/tenant in app_metadata
          // TODO(SEC-009-cleanup): This app_metadata write is now redundant — the
          // custom_access_token_hook reads role/tenant_id from the users table on every
          // token refresh. Retained for the sign-up timing window (first JWT issued before
          // public.users row exists) and rollback safety. Remove after hook is confirmed
          // stable in production, except for this register path where timing requires it.
          const { error: updateError } =
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              app_metadata: createUserAuthMetadata(UserRole.ADMIN, tenant.id),
              user_metadata: createUserProfileMetadata(fullName),
            });

          if (updateError) {
            requestLogger.error(
              { err: updateError },
              "Failed to update user metadata"
            );
            // Non-fatal error, continue with registration
          }

          // Success! Return the created records
          set.status = 201;
          return {
            success: true,
            data: {
              user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                tenantId: user.tenantId,
              },
              tenant: {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
              },
            },
          };
        } catch (dbError: unknown) {
          requestLogger.error(
            { err: dbError },
            "Database error during registration"
          );

          // Rollback: Delete the Supabase auth user
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (rollbackError) {
            requestLogger.error(
              { err: rollbackError },
              "Failed to rollback auth user"
            );
          }

          if (dbError instanceof ApiError) throw dbError;
          throw Errors.internal("Failed to create tenant and user records");
        }
      } catch (error: unknown) {
        requestLogger.error({ err: error }, "Registration error");
        if (error instanceof ApiError) throw error;
        throw Errors.internal("Internal server error during registration");
      }
    },
    {
      body: registerSchema,
      detail: {
        summary: "Register new user with tenant",
        description:
          "Creates a new user account and associated tenant organization",
        tags: ["Authentication"],
      },
    }
  )
  .get(
    "/register/check-tenant-slug/:slug",
    async ({ params, requestLogger }) => {
      try {
        const { slug } = params;

        const existing = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.slug, slug))
          .limit(1);

        return {
          available: existing.length === 0,
          slug,
        };
      } catch (error) {
        requestLogger.error({ err: error }, "Slug check error");
        if (error instanceof ApiError) throw error;
        throw Errors.internal("Failed to check slug availability");
      }
    },
    {
      params: t.Object({
        slug: t.String({ minLength: 1, maxLength: 50 }),
      }),
      detail: {
        summary: "Check tenant slug availability",
        description: "Checks if a tenant slug is available for use",
        tags: ["Authentication"],
      },
    }
  );
