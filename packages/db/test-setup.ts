/**
 * Test Setup - Loads environment variables before tests run
 * This file is automatically loaded by Bun before running any tests
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env from packages/db directory
config({ path: resolve(import.meta.dir, ".env") });

console.log("✓ Test environment loaded");
console.log(`✓ DATABASE_URL: ${process.env.DATABASE_URL ? "Set" : "Not set"}`);

