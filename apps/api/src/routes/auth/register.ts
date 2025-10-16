import { Elysia, t } from "elysia";
import { supabaseAdmin } from "../../lib/supabase";
import { db } from "../../lib/db";
import { tenants, users } from "@supplex/db";
import { eq } from "drizzle-orm";
import { authRateLimit } from "../../lib/rate-limiter";
import type { InsertUser, InsertTenant } from "@supplex/types";
import { UserRole, createUserMetadata } from "@supplex/types";

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
  .use(authRateLimit)
  .post(
    "/register",
    async ({ body, set }) => {
      try {
        const { email, password, fullName, tenantName } = body;

        // Step 1: Create Supabase auth user
        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: false, // Skip email confirmation for MVP
            user_metadata: {
              full_name: fullName,
              tenant_name: tenantName,
            },
          });

        if (authError || !authUser.user) {
          console.error("Supabase auth error:", authError);
          set.status = 400;
          return {
            success: false,
            error: authError?.message || "Failed to create user account",
          };
        }

        const userId = authUser.user.id;

        try {
          // Step 2: Create tenant record
          const uniqueSlug = await generateUniqueSlug(tenantName);

          const newTenant: InsertTenant = {
            name: tenantName,
            slug: uniqueSlug,
            settings: {},
            isActive: true,
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

          // Step 4: Update Supabase Auth user_metadata with role and tenant_id
          // This ensures JWT tokens contain role information for RBAC
          const userMetadata = createUserMetadata(
            UserRole.ADMIN,
            tenant.id,
            fullName
          );

          const { error: updateError } =
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: userMetadata,
            });

          if (updateError) {
            console.error("Failed to update user metadata:", updateError);
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
        } catch (dbError: any) {
          console.error("Database error during registration:", dbError);

          // Rollback: Delete the Supabase auth user
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (rollbackError) {
            console.error("Failed to rollback auth user:", rollbackError);
          }

          set.status = 500;
          return {
            success: false,
            error: "Failed to create tenant and user records",
          };
        }
      } catch (error: any) {
        console.error("Registration error:", error);
        set.status = 500;
        return {
          success: false,
          error: "Internal server error during registration",
        };
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
    async ({ params, set }) => {
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
        console.error("Slug check error:", error);
        set.status = 500;
        return {
          available: false,
          error: "Failed to check slug availability",
        };
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
