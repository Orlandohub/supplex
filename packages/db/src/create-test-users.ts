/**
 * Create Test Users for QA Validation
 * Creates both auth.users (via Supabase Admin API) and public.users records
 * 
 * Usage: 
 * 1. Ensure .env has SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL
 * 2. Run: pnpm --filter @supplex/db create-test-users
 */

// CRITICAL: Load .env FIRST before any other imports
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from multiple possible locations
const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(__dirname, ".env"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../../.env"),
  resolve(__dirname, "../../../.env"), // Root
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    console.log(`✓ Found .env at: ${envPath}`);
    config({ path: envPath, override: true }); // Override ensures it takes precedence
    break;
  }
}

// Validate environment variables BEFORE importing db module
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const databaseUrl = process.env.DATABASE_URL || "";

console.log(`\n🔍 Environment Check:`);
console.log(`   SUPABASE_URL: ${supabaseUrl ? '✓ Set' : '✗ Missing'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✓ Set' : '✗ Missing'}`);
console.log(`   DATABASE_URL: ${databaseUrl ? (databaseUrl.includes('supabase') ? '✓ Points to Supabase' : (databaseUrl.includes('localhost') || databaseUrl.includes('placeholder') ? '✗ Points to localhost/placeholder' : '⚠ Unknown target')) : '✗ Missing'}\n`);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nAdd these to your .env file (root or packages/db):");
  console.error("  SUPABASE_URL=https://xxxxx.supabase.co");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...");
  console.error("\nFind these in: Supabase Dashboard → Settings → API");
  process.exit(1);
}

if (!databaseUrl || databaseUrl.includes("localhost") || databaseUrl.includes("placeholder")) {
  console.error("❌ Missing or invalid DATABASE_URL");
  console.error(`\nCurrent DATABASE_URL: ${databaseUrl || "(empty)"}`);
  console.error("\nAdd this to your packages/db/.env file:");
  console.error("  DATABASE_URL=postgresql://postgres.[project-id]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres");
  console.error("\nCopy the DATABASE_URL from apps/api/.env");
  console.error("Or find in: Supabase Dashboard → Settings → Database → Connection String (URI mode)");
  process.exit(1);
}

// Create Supabase admin client (import can stay at top - doesn't need DB connection)
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Your tenant ID (from server logs)
const ACME_TENANT_ID = "f6a3cf49-e995-4d28-8430-c5bfd0f77184";

// Test users to create
const testUsers = [
  {
    email: "procurement@acme-test.com",
    password: "Procure123!Test",
    fullName: "Peter Procurement",
    role: "procurement_manager",
    tenantId: ACME_TENANT_ID,
    tenantName: "ACME",
  },
  {
    email: "quality@acme-test.com",
    password: "Quality123!Test",
    fullName: "Quinn Quality",
    role: "quality_manager",
    tenantId: ACME_TENANT_ID,
    tenantName: "ACME",
  },
  {
    email: "viewer@acme-test.com",
    password: "Viewer123!Test",
    fullName: "Victor Viewer",
    role: "viewer",
    tenantId: ACME_TENANT_ID,
    tenantName: "ACME",
  },
];

async function createTestUsers() {
  // DYNAMIC IMPORT: Load db module AFTER .env is loaded (not at top of file)
  const { db, users } = await import("./index.js");
  
  // Helper function to create/update public.users record
  async function createPublicUser(userId: string, userData: typeof testUsers[0]) {
    try {
      await db.insert(users).values({
        id: userId,
        tenantId: userData.tenantId,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        isActive: true,
        avatarUrl: null,
        lastLoginAt: null,
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          fullName: userData.fullName,
          role: userData.role,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`   ❌ Failed to create public.users record:`, error);
      throw error;
    }
  }
  
  console.log("🔐 Creating Test Users for ACME tenant...\n");
  console.log(`Tenant ID: ${ACME_TENANT_ID}\n`);

  for (const user of testUsers) {
    try {
      // Step 1: Create auth user via Supabase Admin API
      console.log(`📝 Creating auth user: ${user.email}`);
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        app_metadata: {
          role: user.role,
          tenant_id: user.tenantId,
        },
        user_metadata: {
          full_name: user.fullName,
          tenant_name: user.tenantName,
          email_verified: true,
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          console.log(`⚠️  Auth user already exists: ${user.email}`);
          
          // Get existing user ID
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users.find(u => u.email === user.email);
          
          if (existingUser) {
            console.log(`   Using existing user ID: ${existingUser.id}`);
            
            // Create/update public.users record
            await createPublicUser(existingUser.id, user);
          }
        } else {
          console.error(`❌ Failed to create auth user: ${authError.message}`);
        }
        continue;
      }

      if (!authData.user) {
        console.error(`❌ No user data returned for ${user.email}`);
        continue;
      }

      console.log(`✅ Auth user created: ${authData.user.id}`);

      // Step 2: Create public.users record
      await createPublicUser(authData.user.id, user);

      console.log(`✅ Public user created\n`);

    } catch (err) {
      console.error(`❌ Error creating ${user.email}:`, err);
    }
  }

  // Verify all users
  console.log("\n📊 Verification - All users in ACME tenant:");
  console.log("=".repeat(80));
  
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.tenantId, ACME_TENANT_ID));

  console.table(
    allUsers.map((u) => ({
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
    }))
  );

  console.log("\n✅ Test users created successfully!");
  console.log("\n🧪 You can now test with these credentials:");
  console.log("=".repeat(80));
  testUsers.forEach((u) => {
    console.log(`${u.role.toUpperCase()}: ${u.email} / ${u.password}`);
  });
  console.log("\n🌐 Login at: http://localhost:3000/login");
}

// Run it
createTestUsers()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

