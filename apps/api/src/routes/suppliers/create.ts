import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import { suppliers, users, userInvitations } from "@supplex/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole, InsertSupplierSchema, createUserMetadata } from "@supplex/types";
import { supabaseAdmin } from "../../lib/supabase";
import { randomBytes } from "crypto";

/**
 * POST /api/suppliers
 * Create a new supplier
 *
 * Auth: Requires Admin or Procurement Manager role
 * Tenant Scoping: Automatically sets tenant_id from authenticated user's JWT
 */
export const createSupplierRoute = new Elysia({ prefix: "/suppliers" })
  .use(authenticate)
  .post(
    "/",
    async ({ body, user, set }: any) => {
      // Check role permission
      if (
        !user?.role ||
        ![UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER].includes(user.role)
      ) {
        set.status = 403;
        return {
          success: false,
          error: {
            code: "FORBIDDEN",
            message:
              "Access denied. Required role: Admin or Procurement Manager",
            timestamp: new Date().toISOString(),
          },
        };
      }
      try {
        const tenantId = user.tenantId as string;
        const userId = user.id as string;

        // Validate request body with Zod schema
        const validationResult = InsertSupplierSchema.safeParse(body);

        if (!validationResult.success) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid supplier data",
              errors: validationResult.error.errors.map((err) => ({
                field: err.path.join("."),
                message: err.message,
              })),
              timestamp: new Date().toISOString(),
            },
          };
        }

        const supplierData = validationResult.data;

        // Ensure status has a default value if null/undefined
        // Convert numeric fields to strings for database insertion
        const finalSupplierData = {
          ...supplierData,
          status: supplierData.status || "prospect",
          performanceScore: supplierData.performanceScore !== undefined && supplierData.performanceScore !== null
            ? String(supplierData.performanceScore)
            : null,
          riskScore: supplierData.riskScore !== undefined && supplierData.riskScore !== null
            ? String(supplierData.riskScore)
            : null,
        };

        // Step 1: Create supplier user if supplierContact provided
        let supplierUserId: string | null = null;
        let invitationToken: string | null = null;
        let createdAuthUserId: string | null = null; // Track for cleanup

        if (body.supplierContact) {
          const { name, email, phone } = body.supplierContact;

          // Check if email already exists in users table (tenant-scoped)
          const existingUser = await db.query.users.findFirst({
            where: and(eq(users.tenantId, tenantId), eq(users.email, email)),
          });

          if (existingUser) {
            set.status = 409;
            return {
              success: false,
              error: {
                code: "USER_EMAIL_EXISTS",
                message:
                  "A user with this email already exists in your organization",
                timestamp: new Date().toISOString(),
              },
            };
          }

          try {
            // Create Supabase Auth user (no password)
            const { data: authUser, error: authError } =
              await supabaseAdmin.auth.admin.createUser({
                email,
                email_confirm: true, // Skip email verification
                user_metadata: createUserMetadata(
                  UserRole.SUPPLIER_USER,
                  tenantId,
                  name
                ),
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
          } catch (userError: any) {
            console.error("Error creating supplier user:", userError);

            // Cleanup: Delete Supabase auth user if it was created
            if (createdAuthUserId) {
              try {
                await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
              } catch (cleanupError) {
                console.error(
                  "Failed to cleanup Supabase user:",
                  cleanupError
                );
              }
            }

            set.status = 500;
            return {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Failed to create supplier user",
                timestamp: new Date().toISOString(),
              },
            };
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
            set.status = 409;
            return {
              success: false,
              error: {
                code: "DUPLICATE_SUPPLIER",
                message: "A supplier with a similar name already exists",
                duplicates: duplicateCheck,
                timestamp: new Date().toISOString(),
              },
            };
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
        } catch (supplierError: any) {
          console.error("Error creating supplier:", supplierError);

          // Cleanup: Delete Supabase auth user if it was created
          if (createdAuthUserId) {
            try {
              await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
            } catch (cleanupError) {
              console.error("Failed to cleanup Supabase user:", cleanupError);
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
      } catch (error: any) {
        console.error("Error creating supplier:", error);

        // Handle unique constraint violation (duplicate tax_id)
        if (
          error.code === "23505" &&
          error.constraint === "suppliers_tenant_tax_id_unique"
        ) {
          set.status = 409;
          return {
            success: false,
            error: {
              code: "DUPLICATE_TAX_ID",
              message:
                "A supplier with this Tax ID already exists in your organization",
              timestamp: new Date().toISOString(),
            },
          };
        }

        set.status = 500;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create supplier",
            timestamp: new Date().toISOString(),
          },
        };
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
        metadata: t.Optional(t.Union([t.Record(t.String(), t.Any()), t.Null()])),
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
