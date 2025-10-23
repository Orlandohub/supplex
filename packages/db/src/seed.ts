/**
 * Database Seed Script
 * Creates test data for local development
 *
 * Usage: pnpm db:seed (or bun run src/seed.ts)
 */

// Load environment variables from .env file before importing anything
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple .env locations
const envPaths = [
  resolve(process.cwd(), ".env"), // current working directory
  resolve(__dirname, ".env"), // same dir as script
  resolve(__dirname, "../.env"), // packages/db/.env
  resolve(__dirname, "../../.env"), // root .env
];

console.log("Looking for .env files...");
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    console.log(`✓ Found .env at: ${envPath}`);
    config({ path: envPath });
    break;
  }
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables!");
  console.error(`Current directory: ${process.cwd()}`);
  console.error(`Tried paths: ${envPaths.join(", ")}`);
  process.exit(1);
}

console.log(
  `✓ DATABASE_URL loaded: ${process.env.DATABASE_URL.substring(0, 50)}...`
);

// Import types that don't initialize connections
import { eq } from "drizzle-orm";
import {
  TenantStatus,
  TenantPlan,
  UserRole,
  SupplierCategory,
  SupplierStatus,
  DocumentType,
} from "@supplex/types";

/**
 * Main seed function
 */
async function seed() {
  console.log("🌱 Starting database seed...\n");

  // Dynamically import db AFTER env vars are loaded
  const { db } = await import("./index.js");
  const { tenants, users, suppliers, contacts, documents } = await import(
    "./schema/index.js"
  );

  try {
    // Check if tenants already exist (idempotency)
    const existingTenants = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, "acme-manufacturing"));

    if (existingTenants.length > 0) {
      console.log("⚠️  Seed data already exists. Skipping seed.");
      console.log(
        "   To re-seed, delete existing data from Supabase dashboard first.\n"
      );
      return;
    }

    // =========================================================================
    // Tenant 1: Acme Manufacturing
    // =========================================================================
    console.log("📦 Creating Tenant 1: Acme Manufacturing");
    const [tenant1] = await db
      .insert(tenants)
      .values({
        name: "Acme Manufacturing",
        slug: "acme-manufacturing",
        status: TenantStatus.ACTIVE,
        plan: TenantPlan.PROFESSIONAL,
        settings: {
          evaluationFrequency: "quarterly",
          notificationEmail: "admin@acme-mfg.com",
          qualificationRequirements: [
            "ISO 9001 Certification",
            "Quality Audit Report",
            "Insurance Certificate",
          ],
        },
        subscriptionEndsAt: new Date("2026-12-31"),
      })
      .returning();

    if (!tenant1) throw new Error("Failed to create tenant1");
    console.log(`   ✓ Tenant created: ${tenant1.id}`);

    // Create user for Tenant 1
    const [user1] = await db
      .insert(users)
      .values({
        id: "11111111-1111-1111-1111-111111111111", // Fixed UUID for testing
        tenantId: tenant1.id,
        email: "admin@acme-mfg.com",
        fullName: "Alice Johnson",
        role: UserRole.ADMIN,
        avatarUrl: null,
        isActive: true,
      })
      .returning();

    if (!user1) throw new Error("Failed to create user1");
    console.log(`   ✓ User created: ${user1.email}\n`);

    // Create 5 suppliers for Tenant 1
    console.log("   Creating 5 suppliers for Acme Manufacturing:");

    const suppliersData1 = [
      {
        name: "Steel Solutions GmbH",
        taxId: "DE123456789",
        category: SupplierCategory.RAW_MATERIALS,
        status: SupplierStatus.APPROVED,
        performanceScore: "4.5",
        contactName: "Hans Schmidt",
        contactEmail: "hans.schmidt@steelsolutions.de",
        contactPhone: "+49 30 12345678",
        address: {
          street: "Hauptstraße 100",
          city: "Frankfurt",
          state: "Hessen",
          postalCode: "60311",
          country: "Germany",
        },
        certifications: [
          {
            type: "ISO 9001:2015",
            issueDate: new Date("2023-01-15"),
            expiryDate: new Date("2026-01-15"),
          },
        ],
        metadata: { specialization: "High-grade steel alloys" },
        riskScore: "2.5",
      },
      {
        name: "Precision Components Ltd",
        taxId: "GB987654321",
        category: SupplierCategory.COMPONENTS,
        status: SupplierStatus.APPROVED,
        performanceScore: "4.8",
        contactName: "Sarah Williams",
        contactEmail: "sarah.williams@precisioncomp.co.uk",
        contactPhone: "+44 20 7946 0958",
        address: {
          street: "Industrial Park, Unit 5",
          city: "Birmingham",
          state: "West Midlands",
          postalCode: "B1 1AA",
          country: "United Kingdom",
        },
        certifications: [
          {
            type: "ISO 9001:2015",
            issueDate: new Date("2022-06-01"),
            expiryDate: new Date("2025-06-01"),
          },
          {
            type: "AS9100D",
            issueDate: new Date("2023-03-01"),
            expiryDate: new Date("2026-03-01"),
          },
        ],
        metadata: { specialization: "CNC machined parts" },
        riskScore: "1.8",
      },
      {
        name: "EcoPackaging Solutions",
        taxId: "FR445566778",
        category: SupplierCategory.PACKAGING,
        status: SupplierStatus.QUALIFIED,
        performanceScore: "4.2",
        contactName: "Pierre Dubois",
        contactEmail: "pierre.dubois@ecopack.fr",
        contactPhone: "+33 1 42 86 82 00",
        address: {
          street: "12 Rue de la Paix",
          city: "Paris",
          state: "Île-de-France",
          postalCode: "75002",
          country: "France",
        },
        certifications: [
          {
            type: "FSC Certification",
            issueDate: new Date("2023-09-01"),
            expiryDate: new Date("2028-09-01"),
          },
        ],
        metadata: { specialization: "Sustainable packaging materials" },
        riskScore: "3.2",
      },
      {
        name: "FastLogistics Express",
        taxId: "NL998877665",
        category: SupplierCategory.LOGISTICS,
        status: SupplierStatus.CONDITIONAL,
        performanceScore: "3.5",
        contactName: "Jan van der Berg",
        contactEmail: "jan.vandenberg@fastlogistics.nl",
        contactPhone: "+31 20 794 0000",
        address: {
          street: "Havenweg 45",
          city: "Rotterdam",
          state: "Zuid-Holland",
          postalCode: "3089 KA",
          country: "Netherlands",
        },
        certifications: [],
        metadata: { specialization: "European distribution network" },
        riskScore: "4.5",
      },
      {
        name: "Quality Testing Labs",
        taxId: "CH556677889",
        category: SupplierCategory.SERVICES,
        status: SupplierStatus.PROSPECT,
        performanceScore: null,
        contactName: "Maria Rossi",
        contactEmail: "maria.rossi@qtlabs.ch",
        contactPhone: "+41 44 123 45 67",
        address: {
          street: "Teststrasse 88",
          city: "Zurich",
          state: "Zurich",
          postalCode: "8001",
          country: "Switzerland",
        },
        certifications: [
          {
            type: "ISO/IEC 17025",
            issueDate: new Date("2023-05-01"),
            expiryDate: new Date("2026-05-01"),
          },
        ],
        metadata: { specialization: "Material testing and certification" },
        riskScore: null,
      },
    ];

    for (const supplierData of suppliersData1) {
      const [supplier] = await db
        .insert(suppliers)
        .values({
          ...supplierData,
          tenantId: tenant1.id,
          createdBy: user1.id,
        })
        .returning();

      if (!supplier) throw new Error("Failed to create supplier");
      console.log(`      ✓ ${supplier.name} (${supplier.status})`);

      // Create 2-3 contacts per supplier
      const numContacts = Math.floor(Math.random() * 2) + 2; // 2 or 3
      for (let i = 0; i < numContacts; i++) {
        await db.insert(contacts).values({
          tenantId: tenant1.id,
          supplierId: supplier.id,
          name: `Contact ${i + 1} for ${supplier.name}`,
          title: i === 0 ? "Primary Contact" : "Secondary Contact",
          email: `contact${i + 1}@${supplier.name.toLowerCase().replace(/\s+/g, "")}.com`,
          phone: supplier.contactPhone,
          isPrimary: i === 0,
        });
      }

      // Create sample document metadata (no actual files)
      if (supplier.status !== SupplierStatus.PROSPECT) {
        await db.insert(documents).values({
          tenantId: tenant1.id,
          supplierId: supplier.id,
          filename: "ISO-9001-Certificate.pdf",
          documentType: DocumentType.CERTIFICATE,
          storagePath: `tenants/${tenant1.id}/suppliers/${supplier.id}/ISO-9001-Certificate.pdf`,
          fileSize: 1024567,
          mimeType: "application/pdf",
          description: "ISO 9001:2015 Quality Management Certificate",
          expiryDate: new Date("2026-01-15"),
          uploadedBy: user1.id,
        });
      }
    }

    console.log("");

    // =========================================================================
    // Tenant 2: Global Logistics GmbH
    // =========================================================================
    console.log("📦 Creating Tenant 2: Global Logistics GmbH");
    const [tenant2] = await db
      .insert(tenants)
      .values({
        name: "Global Logistics GmbH",
        slug: "global-logistics",
        status: TenantStatus.ACTIVE,
        plan: TenantPlan.STARTER,
        settings: {
          evaluationFrequency: "annually",
          notificationEmail: "procurement@globallogistics.de",
        },
        subscriptionEndsAt: new Date("2025-12-31"),
      })
      .returning();

    if (!tenant2) throw new Error("Failed to create tenant2");
    console.log(`   ✓ Tenant created: ${tenant2.id}`);

    // Create user for Tenant 2
    const [user2] = await db
      .insert(users)
      .values({
        id: "22222222-2222-2222-2222-222222222222", // Fixed UUID for testing
        tenantId: tenant2.id,
        email: "procurement@globallogistics.de",
        fullName: "Klaus Mueller",
        role: UserRole.PROCUREMENT_MANAGER,
        avatarUrl: null,
        isActive: true,
      })
      .returning();

    if (!user2) throw new Error("Failed to create user2");
    console.log(`   ✓ User created: ${user2.email}\n`);

    // Create 5 suppliers for Tenant 2
    console.log("   Creating 5 suppliers for Global Logistics GmbH:");

    const suppliersData2 = [
      {
        name: "TransEurope Shipping",
        taxId: "DE887766554",
        category: SupplierCategory.LOGISTICS,
        status: SupplierStatus.APPROVED,
        performanceScore: "4.6",
        contactName: "Thomas Weber",
        contactEmail: "thomas.weber@transeurope.de",
        contactPhone: "+49 40 12345678",
        address: {
          street: "Hafenstraße 200",
          city: "Hamburg",
          state: "Hamburg",
          postalCode: "20359",
          country: "Germany",
        },
        certifications: [],
        metadata: { specialization: "International freight forwarding" },
        riskScore: "2.0",
      },
      {
        name: "IT Support Partners",
        taxId: "DE554433221",
        category: SupplierCategory.SERVICES,
        status: SupplierStatus.APPROVED,
        performanceScore: "4.7",
        contactName: "Anna Schmidt",
        contactEmail: "anna.schmidt@itsupport.de",
        contactPhone: "+49 30 98765432",
        address: {
          street: "Tech Campus 5",
          city: "Berlin",
          state: "Berlin",
          postalCode: "10115",
          country: "Germany",
        },
        certifications: [
          {
            type: "ISO 27001",
            issueDate: new Date("2023-02-01"),
            expiryDate: new Date("2026-02-01"),
          },
        ],
        metadata: { specialization: "Managed IT services" },
        riskScore: "1.5",
      },
      {
        name: "Office Supplies Direct",
        taxId: "DE443322110",
        category: SupplierCategory.COMPONENTS,
        status: SupplierStatus.APPROVED,
        performanceScore: "4.0",
        contactName: "Michael Brown",
        contactEmail: "michael.brown@officesupplies.de",
        contactPhone: "+49 69 87654321",
        address: {
          street: "Industrieweg 12",
          city: "Munich",
          state: "Bavaria",
          postalCode: "80331",
          country: "Germany",
        },
        certifications: [],
        metadata: { specialization: "Office equipment and supplies" },
        riskScore: "2.8",
      },
      {
        name: "Warehouse Solutions Pro",
        taxId: "DE332211009",
        category: SupplierCategory.SERVICES,
        status: SupplierStatus.QUALIFIED,
        performanceScore: "3.8",
        contactName: "Julia Fischer",
        contactEmail: "julia.fischer@warehousepro.de",
        contactPhone: "+49 221 11223344",
        address: {
          street: "Logistikpark 7",
          city: "Cologne",
          state: "North Rhine-Westphalia",
          postalCode: "50667",
          country: "Germany",
        },
        certifications: [],
        metadata: { specialization: "Warehouse management systems" },
        riskScore: "3.5",
      },
      {
        name: "Fleet Maintenance Services",
        taxId: "DE221100998",
        category: SupplierCategory.SERVICES,
        status: SupplierStatus.PROSPECT,
        performanceScore: null,
        contactName: "Stefan Bauer",
        contactEmail: "stefan.bauer@fleetmaintenance.de",
        contactPhone: "+49 711 55667788",
        address: {
          street: "Werkstattstraße 30",
          city: "Stuttgart",
          state: "Baden-Württemberg",
          postalCode: "70173",
          country: "Germany",
        },
        certifications: [],
        metadata: { specialization: "Commercial vehicle maintenance" },
        riskScore: null,
      },
    ];

    for (const supplierData of suppliersData2) {
      const [supplier] = await db
        .insert(suppliers)
        .values({
          ...supplierData,
          tenantId: tenant2.id,
          createdBy: user2.id,
        })
        .returning();

      if (!supplier) throw new Error("Failed to create supplier");
      console.log(`      ✓ ${supplier.name} (${supplier.status})`);

      // Create 2-3 contacts per supplier
      const numContacts = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < numContacts; i++) {
        await db.insert(contacts).values({
          tenantId: tenant2.id,
          supplierId: supplier.id,
          name: `Contact ${i + 1} for ${supplier.name}`,
          title: i === 0 ? "Account Manager" : "Support Contact",
          email: `contact${i + 1}@${supplier.name.toLowerCase().replace(/\s+/g, "")}.com`,
          phone: supplier.contactPhone,
          isPrimary: i === 0,
        });
      }
    }

    console.log("");
    console.log("✅ Database seed completed successfully!\n");
    console.log("Summary:");
    console.log(`   - 2 tenants created`);
    console.log(`   - 2 users created (1 per tenant)`);
    console.log(`   - 10 suppliers created (5 per tenant)`);
    console.log(`   - ~25 contacts created`);
    console.log(`   - Sample documents created for approved suppliers\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during seed:");
    console.error(error);
    process.exit(1);
  }
}

// Run seed
seed();
