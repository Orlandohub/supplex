/**
 * Create Supabase Auth Users for Seeded Data
 * This script creates auth users that match the application users from seed
 *
 * Usage: pnpm --filter @supplex/db create-auth-users
 */

// Load environment variables
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(__dirname, ".env"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../../.env"),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    console.log(`✓ Found .env at: ${envPath}`);
    config({ path: envPath });
    break;
  }
}

import { createClient } from "@supabase/supabase-js";

// You'll need SUPABASE_SERVICE_ROLE_KEY for this
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Add these to your .env file:");
  console.error("  SUPABASE_URL=https://your-project.supabase.co");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testUsers = [
  {
    email: "admin@acme-mfg.com",
    password: "Admin123!",
    fullName: "Admin User",
  },
  {
    email: "procurement@globallogistics.de",
    password: "Admin123!",
    fullName: "Procurement Manager",
  },
];

async function createAuthUsers() {
  console.log("🔐 Creating Supabase Auth Users...\n");

  for (const user of testUsers) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
        },
      });

      if (error) {
        console.error(`❌ Failed to create ${user.email}: ${error.message}`);
      } else {
        console.log(`✅ Created auth user: ${user.email}`);
        console.log(`   User ID: ${data.user?.id}`);
        console.log(`   Password: ${user.password}\n`);
      }
    } catch (err) {
      console.error(`❌ Error creating ${user.email}:`, err);
    }
  }

  console.log("\n📝 Next Steps:");
  console.log("1. Go to Supabase Dashboard → Table Editor → users table");
  console.log(
    "2. Update the 'id' field for each user with the Auth User ID shown above"
  );
  console.log("3. You can now log in with these credentials!");
}

createAuthUsers()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
