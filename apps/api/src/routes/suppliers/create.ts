import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers, users, userInvitations } from "@supplex/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { authenticatedRoute } from "../../lib/route-plugins";
import {
  UserRole,
  InsertSupplierSchema,
  createUserAuthMetadata,
  createUserProfileMetadata,
} from "@supplex/types";
import { supabaseAdmin } from "../../lib/supabase";
import { randomBytes } from "crypto";
import { ApiError, Errors } from "../../lib/errors";
import { isPostgresError } from "../../lib/error-utils";

/**
 * POST /api/suppliers
 * Create a new supplier
 *
 * Auth: Requires Admin or Procurement Manager role
 * Tenant Scoping: Automatically sets tenant_id from authenticated user's JWT
 */
export const createSupplierRoute = new Elysia({ prefix: "/suppliers" })
  .use(authenticatedRoute)
  .post(
    "/",
    async ({ body, user, set, requestLogger }) => {
      // Check role permission
      if (
        !user?.role ||
        ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(user.role)
      ) {
        throw Errors.forbidden(
          "Access denied. Required role: Admin or Procurement Manager"
        );
      }
      try {
        const tenantId = user.tenantId;
        const userId = user.id;

        // Validate request body with Zod schema
        const validationResult = InsertSupplierSchema.safeParse(body);

        if (!validationResult.success) {
          throw new ApiError(400, "VALIDATION_ERROR", "Invalid supplier data");
        }

        const supplierData = validationResult.data;

        // Ensure status has a default value if null/undefined
        // Convert numeric fields to strings for database insertion
        const finalSupplierData = {
          ...supplierData,
          status: supplierData.status || "prospect",
          performanceScore:
            supplierData.performanceScore !== undefined &&
            supplierData.performanceScore !== null
              ? String(supplierData.performanceScore)
              : null,
          riskScore:
            supplierData.riskScore !== undefined &&
            supplierData.riskScore !== null
              ? String(supplierData.riskScore)
              : null,
        };

        // Step 1: Create supplier user if supplierContact provided
        let supplierUserId: string | null = null;
        let invitationToken: string | null = null;
        let createdAuthUserId: string | null = null; // Track for cleanup

        if (body.supplierContact) {
          const { name, email, phone: _phone } = body.supplierContact;

          // Check if email already exists in users table (tenant-scoped)
          const existingUser = await db.query.users.findFirst({
            where: and(eq(users.tenantId, tenantId), eq(users.email, email)),
          });

          if (existingUser) {
            throw new ApiError(
              409,
              "USER_EMAIL_EXISTS",
              "A user with this email already exists in your organization"
            );
          }

          try {
            // Create Supabase Auth user (no password)
            // TODO(SEC-009-cleanup): The app_metadata write below is now redundant — the
            // custom_access_token_hook reads role/tenant_id from the users table on every
            // token refresh. Remove after hook is confirmed stable in production.
            const { data: authUser, error: authError } =
              await supabaseAdmin.auth.admin.createUser({
                email,
                email_confirm: true,
                app_metadata: createUserAuthMetadata(
                  UserRole.SUPPLIER_USER,
                  tenantId
                ),
                user_metadata: createUserProfileMetadata(name),
              });

            if (authError || !authUser.user) {
              throw new Error(
                `Supabase user creation failed: ${authError?.message}`
              );
            }

            createdAuthUserId = authUser.user.id;

            // Insert user record into local database
            const newUserResult = await db
              .insert(users)
              .values({
                id: authUser.user.id,
                tenantId,
                email,
                fullName: name,
                role: UserRole.SUPPLIER_USER,
                status: "pending_activation",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            const newUser = newUserResult[0];
            if (!newUser) {
              throw new Error("Failed to create user record");
            }

            supplierUserId = newUser.id;

            // Generate secure invitation token
            const token = randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

            // Insert invitation record
            await db.insert(userInvitations).values({
              userId: newUser.id,
              tenantId,
              token,
              expiresAt,
              createdBy: userId,
              createdAt: new Date(),
            });

            invitationToken = token;
          } catch (userError: unknown) {
            requestLogger.error(
              { err: userError },
              "Error creating supplier user"
            );

            // Cleanup: Delete Supabase auth user if it was created
            if (createdAuthUserId) {
              try {
                await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
              } catch (cleanupError) {
                requestLogger.error(
                  { err: cleanupError },
                  "Failed to cleanup Supabase user"
                );
              }
            }

            throw Errors.internal("Failed to create supplier user");
          }
        }

        // Check for duplicate supplier name (fuzzy match) unless forceSave is true
        if (!body.forceSave) {
          const duplicateCheck = await db
            .select({
              id: suppliers.id,
              name: suppliers.name,
            })
            .from(suppliers)
            .where(
              and(
                eq(suppliers.tenantId, tenantId),
                isNull(suppliers.deletedAt),
                sql`LOWER(${suppliers.name}) LIKE LOWER(${"%" + supplierData.name + "%"})`
              )
            )
            .limit(5);

          if (duplicateCheck.length > 0) {
            throw new ApiError(
              409,
              "DUPLICATE_SUPPLIER",
              "A supplier with a similar name already exists"
            );
          }
        }

        // Insert new supplier with supplierUserId
        let newSupplier;
        try {
          newSupplier = await db
            .insert(suppliers)
            .values({
              ...finalSupplierData,
              tenantId,
              supplierUserId, // null if no contact user created
              createdBy: userId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
        } catch (supplierError: unknown) {
          requestLogger.error(
            { err: supplierError },
            "Error creating supplier record"
          );

          // Cleanup: Delete Supabase auth user if it was created
          if (createdAuthUserId) {
            try {
              await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
            } catch (cleanupError) {
              requestLogger.error(
                { err: cleanupError },
                "Failed to cleanup Supabase user"
              );
            }
          }

          throw supplierError; // Re-throw to be caught by outer catch block
        }

        // Fetch created user info if exists
        const supplierUser = supplierUserId
          ? await db.query.users.findFirst({
              where: eq(users.id, supplierUserId),
              columns: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                status: true,
                isActive: true,
              },
            })
          : null;

        set.status = 201;
        return {
          success: true,
          data: {
            supplier: newSupplier[0],
            supplierUser,
            invitationToken,
          },
        };
      } catch (error: unknown) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "Error creating supplier");

        if (
          isPostgresError(error) &&
          error.code === "23505" &&
          error.constraint === "suppliers_tenant_tax_id_unique"
        ) {
          throw new ApiError(
            409,
            "DUPLICATE_TAX_ID",
            "A supplier with this Tax ID already exists in your organization"
          );
        }

        throw Errors.internal("Failed to create supplier");
      }
    },
    {
      body: t.Object({
        name: t.String(),
        taxId: t.String(),
        category: t.String(),
        status: t.Optional(t.Union([t.String(), t.Null()])),
        contactName: t.String(),
        contactEmail: t.String(),
        contactPhone: t.Optional(t.Union([t.String(), t.Null()])),
        address: t.Object({
          street: t.String(),
          city: t.String(),
          state: t.String(),
          postalCode: t.String(),
          country: t.String(),
        }),
        website: t.Optional(t.Union([t.String(), t.Null()])),
        certifications: t.Optional(t.Union([t.Array(t.Any()), t.Null()])),
        metadata: t.Optional(
          t.Union([t.Record(t.String(), t.Any()), t.Null()])
        ),
        riskScore: t.Optional(t.Union([t.Number(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
        forceSave: t.Optional(t.Union([t.Boolean(), t.Null()])),
        supplierContact: t.Optional(
          t.Object({
            name: t.String(),
            email: t.String({ format: "email" }),
            phone: t.Optional(t.String()),
          })
        ),
      }),
      detail: {
        summary: "Create new supplier",
        description: "Creates a new supplier (Admin/Procurement Manager only)",
        tags: ["Suppliers"],
      },
    }
  );
