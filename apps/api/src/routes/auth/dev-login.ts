import { Elysia, t } from "elysia";
import { config } from "../../config";
import { db } from "../../lib/db";
import { users } from "@supplex/db";
import { eq } from "drizzle-orm";
import { authCache } from "../../lib/auth-cache";
import { supabaseAdmin } from "../../lib/supabase";
import { randomBytes } from "crypto";

/**
 * Development Quick Login
 *
 * DEVELOPMENT ONLY — Sets a temporary password for the user via Supabase Admin
 * and returns it so the client can call signInWithPassword (identical to normal
 * login). This guarantees the same auth flow, cookie handling, and redirect
 * behavior as a real login.
 *
 * Security: Environment check ensures this route is never accessible in production.
 */
export const devLoginRoute = new Elysia({ prefix: "/auth" })
  .post("/dev/login", async ({ body, set }) => {
    if (config.nodeEnv !== "development") {
      set.status = 404;
      return { error: "Not found" };
    }

    try {
      const { userId } = body;

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
          tenantId: users.tenantId,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      if (!user.isActive) {
        set.status = 403;
        return { success: false, error: "User is inactive" };
      }

      // Set a temporary random password via Admin API
      const tempPassword = `dev-${randomBytes(16).toString("hex")}`;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: tempPassword }
      );

      if (error) {
        console.error("❌ Supabase updateUser error:", error);
        set.status = 500;
        return { success: false, error: error.message || "Failed to prepare login" };
      }

      // Cache user for the API middleware
      await authCache.set(user.id, {
        userId: user.id,
        email: user.email,
        role: user.role as any,
        tenantId: user.tenantId,
        isActive: user.isActive,
        fullName: user.fullName,
        cachedAt: Date.now(),
      });

      // Client will use signInWithPassword with these credentials
      return {
        success: true,
        email: user.email,
        tempPassword,
      };
    } catch (error) {
      console.error("❌ Dev login error:", error);
      set.status = 500;
      return { success: false, error: "Internal server error during dev login" };
    }
  }, {
    body: t.Object({
      userId: t.String({
        format: "uuid",
        description: "User ID to login as",
      }),
    }),
    detail: {
      summary: "Dev quick login (Development Only)",
      description: "Logs in a user without password for development testing. Returns 404 in production.",
      tags: ["Authentication", "Development"],
    },
  });
