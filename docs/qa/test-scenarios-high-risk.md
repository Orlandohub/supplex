# Supplex - High-Risk Test Scenarios

**Document Version:** 1.0  
**Date:** October 13, 2025  
**Author:** Quinn (Test Architect)  
**Status:** Ready for Implementation

---

## Overview

This document provides detailed, executable test scenarios for Supplex's three highest-risk areas identified during early architecture review. Each scenario includes Given-When-Then specifications, technical implementation guidance, test data, and acceptance criteria.

**Target Audience:** QA Engineers, Backend Developers, Security Testers

**Risk Areas Covered:**

1. Multi-Tenant Data Isolation (CRITICAL RISK)
2. Bun/ElysiaJS Production Stability (HIGH RISK)
3. Qualification Workflow State Management (MEDIUM-HIGH RISK)

---

## 1. Multi-Tenant Data Isolation (CRITICAL RISK)

### Risk Summary

- **Impact:** CATASTROPHIC (data breach, regulatory violation, customer loss)
- **Probability:** Medium (complex dual-query architecture)
- **Test Priority:** P0 - Must pass before any deployment

### Test Coverage Requirements

- **Unit Tests:** 95%+ for tenant filtering logic
- **Integration Tests:** 100% of API endpoints verified for isolation
- **Security Tests:** Penetration testing before MVP launch
- **Monitoring:** Automated daily verification in production

---

### Scenario 1.1: Cross-Tenant API Data Access Prevention

**Risk:** User with Tenant A credentials attempts to access Tenant B supplier data via API

**Priority:** P0 - Critical Security

#### Given-When-Then Specification

```gherkin
Feature: Multi-tenant data isolation via ElysiaJS API

  Background:
    Given the following tenants exist:
      | Tenant ID  | Name                  | Status |
      | tenant-a   | Acme Manufacturing    | active |
      | tenant-b   | Beta Industries       | active |
    And the following users exist:
      | User ID  | Email              | Tenant ID | Role               |
      | user-a1  | alice@acme.com     | tenant-a  | procurement_manager|
      | user-b1  | bob@beta.com       | tenant-b  | procurement_manager|
    And the following suppliers exist:
      | Supplier ID | Name          | Tenant ID | Status   |
      | sup-a1      | Supplier A1   | tenant-a  | approved |
      | sup-a2      | Supplier A2   | tenant-a  | approved |
      | sup-b1      | Supplier B1   | tenant-b  | approved |

  Scenario: User cannot retrieve supplier from different tenant
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I GET "/api/v1/suppliers/sup-b1"
    Then the response status should be 404
    And the response body should contain:
      """json
      {
        "error": {
          "code": "RESOURCE_NOT_FOUND",
          "message": "Supplier not found",
          "timestamp": "<ISO8601>",
          "requestId": "<UUID>"
        }
      }
      """
    And the response should NOT reveal that the supplier exists in another tenant
    And the request should be logged with:
      | Field      | Value       |
      | userId     | user-a1     |
      | tenantId   | tenant-a    |
      | resourceId | sup-b1      |
      | outcome    | DENIED      |

  Scenario: User cannot list suppliers from different tenant
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I GET "/api/v1/suppliers"
    Then the response status should be 200
    And the response should contain exactly 2 suppliers
    And all suppliers should have tenantId "tenant-a"
    And the response should NOT contain supplier "sup-b1"

  Scenario: User cannot create supplier for different tenant
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I POST "/api/v1/suppliers" with body:
      """json
      {
        "name": "Malicious Supplier",
        "tenantId": "tenant-b",
        "taxId": "12345",
        "category": "raw_materials",
        "contactName": "John Doe",
        "contactEmail": "john@example.com",
        "contactPhone": "+1234567890",
        "address": {
          "street": "123 Main St",
          "city": "Berlin",
          "postalCode": "10115",
          "country": "DE"
        }
      }
      """
    Then the response status should be 403
    And the response should contain error code "FORBIDDEN"
    And no supplier should be created in tenant-b
    And an alert should be triggered for "TENANT_TAMPERING_ATTEMPT"

  Scenario: User cannot update supplier from different tenant
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I PUT "/api/v1/suppliers/sup-b1" with body:
      """json
      {
        "status": "blocked"
      }
      """
    Then the response status should be 404
    And supplier "sup-b1" should remain unchanged in tenant-b
    And the request should be logged as DENIED

  Scenario: Bulk operations respect tenant boundaries
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I POST "/api/v1/suppliers/bulk-update" with body:
      """json
      {
        "supplierIds": ["sup-a1", "sup-b1"],
        "updates": {
          "status": "conditional"
        }
      }
      """
    Then the response status should be 207 (Multi-Status)
    And the response should indicate:
      | Supplier | Status | Reason            |
      | sup-a1   | 200    | Updated           |
      | sup-b1   | 404    | Not found         |
    And only supplier "sup-a1" should be updated
    And supplier "sup-b1" should remain unchanged
```

#### Technical Implementation

**Test Code (Vitest/Bun Test):**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { testClient } from "../helpers/test-client";
import {
  createTestTenant,
  createTestUser,
  createTestSupplier,
} from "../helpers/fixtures";
import { getAuthToken } from "../helpers/auth";

describe("Multi-tenant isolation: Cross-tenant API access", () => {
  let tenantA: any, tenantB: any;
  let userA: any, userB: any;
  let supplierA1: any, supplierB1: any;

  beforeEach(async () => {
    // Setup test data
    tenantA = await createTestTenant({ name: "Acme Manufacturing" });
    tenantB = await createTestTenant({ name: "Beta Industries" });

    userA = await createTestUser({
      email: "alice@acme.com",
      tenantId: tenantA.id,
      role: "procurement_manager",
    });
    userB = await createTestUser({
      email: "bob@beta.com",
      tenantId: tenantB.id,
      role: "procurement_manager",
    });

    supplierA1 = await createTestSupplier({
      name: "Supplier A1",
      tenantId: tenantA.id,
    });
    supplierB1 = await createTestSupplier({
      name: "Supplier B1",
      tenantId: tenantB.id,
    });
  });

  it("should return 404 when user tries to access supplier from different tenant", async () => {
    const tokenA = await getAuthToken(userA.email);

    const response = await testClient
      .get(`/api/v1/suppliers/${supplierB1.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(response.body.error.message).not.toContain("tenant"); // Don't leak info

    // Verify audit log
    const auditLog = await getLastAuditLog();
    expect(auditLog).toMatchObject({
      userId: userA.id,
      tenantId: tenantA.id,
      action: "READ",
      resourceType: "supplier",
      resourceId: supplierB1.id,
      outcome: "DENIED",
      reason: "RESOURCE_NOT_FOUND",
    });
  });

  it("should only return suppliers from user tenant", async () => {
    const tokenA = await getAuthToken(userA.email);

    const response = await testClient
      .get("/api/v1/suppliers")
      .set("Authorization", `Bearer ${tokenA}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(supplierA1.id);
    expect(response.body.data[0].tenantId).toBe(tenantA.id);

    // Verify no tenant B data leaked
    const tenantBSupplier = response.body.data.find(
      (s: any) => s.tenantId === tenantB.id
    );
    expect(tenantBSupplier).toBeUndefined();
  });

  it("should prevent tenant ID tampering on create", async () => {
    const tokenA = await getAuthToken(userA.email);

    const response = await testClient
      .post("/api/v1/suppliers")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "Malicious Supplier",
        tenantId: tenantB.id, // Try to create in different tenant
        taxId: "12345",
        category: "raw_materials",
        contactName: "John Doe",
        contactEmail: "john@example.com",
        contactPhone: "+1234567890",
        address: {
          street: "123 Main St",
          city: "Berlin",
          postalCode: "10115",
          country: "DE",
        },
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");

    // Verify supplier was NOT created in tenant B
    const tenantBSuppliers = await getSuppliersByTenant(tenantB.id);
    const maliciousSupplier = tenantBSuppliers.find(
      (s: any) => s.name === "Malicious Supplier"
    );
    expect(maliciousSupplier).toBeUndefined();

    // Verify security alert triggered
    const alerts = await getSecurityAlerts({
      type: "TENANT_TAMPERING_ATTEMPT",
      since: new Date(Date.now() - 60000), // Last 1 minute
    });
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toMatchObject({
      userId: userA.id,
      attemptedTenantId: tenantB.id,
      actualTenantId: tenantA.id,
    });
  });
});
```

**Helper Functions:**

```typescript
// helpers/test-client.ts
import { app } from "../../src/index";
import { treaty } from "@elysiajs/eden";

export const testClient = treaty(app);

// helpers/fixtures.ts
import { db } from "../../src/db";
import { tenants, users, suppliers } from "../../src/db/schema";

export async function createTestTenant(
  data: Partial<typeof tenants.$inferInsert>
) {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: data.name || "Test Tenant",
      slug: data.slug || `test-${Date.now()}`,
      status: "active",
      plan: "professional",
      settings: {},
      ...data,
    })
    .returning();

  return tenant;
}

export async function createTestUser(data: Partial<typeof users.$inferInsert>) {
  const [user] = await db
    .insert(users)
    .values({
      email: data.email || `test-${Date.now()}@example.com`,
      fullName: data.fullName || "Test User",
      role: data.role || "viewer",
      tenantId: data.tenantId!,
      isActive: true,
      ...data,
    })
    .returning();

  return user;
}

export async function createTestSupplier(
  data: Partial<typeof suppliers.$inferInsert>
) {
  const [supplier] = await db
    .insert(suppliers)
    .values({
      tenantId: data.tenantId!,
      name: data.name || "Test Supplier",
      taxId: data.taxId || `TAX-${Date.now()}`,
      category: data.category || "raw_materials",
      status: data.status || "approved",
      contactName: "John Doe",
      contactEmail: "john@example.com",
      contactPhone: "+1234567890",
      address: {
        street: "123 Main St",
        city: "Berlin",
        postalCode: "10115",
        country: "DE",
      },
      certifications: [],
      metadata: {},
      ...data,
    })
    .returning();

  return supplier;
}
```

#### Test Data Requirements

```yaml
Tenants:
  - id: tenant-a
    name: Acme Manufacturing
    status: active
    plan: professional

  - id: tenant-b
    name: Beta Industries
    status: active
    plan: starter

Users:
  - id: user-a1
    email: alice@acme.com
    tenantId: tenant-a
    role: procurement_manager

  - id: user-b1
    email: bob@beta.com
    tenantId: tenant-b
    role: procurement_manager

Suppliers:
  - id: sup-a1
    name: Supplier A1
    tenantId: tenant-a
    status: approved

  - id: sup-b1
    name: Supplier B1
    tenantId: tenant-b
    status: approved
```

#### Acceptance Criteria

✅ **Pass Criteria:**

- All cross-tenant access attempts return 404 (not 403 to avoid info leak)
- No data from other tenants visible in list endpoints
- Tenant ID tampering blocked with 403 error
- Security alerts triggered for tampering attempts
- All requests logged with correct tenant context
- Zero false negatives (legitimate same-tenant access works)

❌ **Fail Criteria:**

- Any cross-tenant data access succeeds
- Error messages reveal existence of resources in other tenants
- No audit logs for denied access attempts
- Security alerts not triggered
- Performance degradation >10% due to filtering

---

### Scenario 1.2: Supabase RLS Policy Verification

**Risk:** RLS policies misconfigured allowing cross-tenant data leaks via Remix loaders

**Priority:** P0 - Critical Security

#### Given-When-Then Specification

````gherkin
Feature: Multi-tenant data isolation via Supabase RLS

  Background:
    Given the following RLS policies are enabled on all tables:
      | Table        | Policy Name              | Policy Type |
      | suppliers    | tenant_isolation_select  | SELECT      |
      | suppliers    | tenant_isolation_insert  | INSERT      |
      | suppliers    | tenant_isolation_update  | UPDATE      |
      | suppliers    | tenant_isolation_delete  | DELETE      |
      | evaluations  | tenant_isolation_select  | SELECT      |
      | complaints   | tenant_isolation_select  | SELECT      |

  Scenario: RLS prevents cross-tenant SELECT via Supabase SDK
    Given I am authenticated as "alice@acme.com" (Tenant A)
    And my JWT contains "tenant_id: tenant-a"
    When I execute Supabase query:
      """sql
      SELECT * FROM suppliers WHERE id = 'sup-b1'
      """
    Then the query should return zero rows
    And no error should be raised
    And the query execution should be logged

  Scenario: RLS prevents cross-tenant INSERT
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I attempt to insert a supplier with tenantId "tenant-b":
      """typescript
      await supabase.from('suppliers').insert({
        id: 'sup-malicious',
        tenant_id: 'tenant-b', // Different tenant
        name: 'Malicious Supplier',
        // ... other fields
      })
      ```
    Then the insert should fail with RLS policy violation
    And no row should be inserted
    And an error should be returned to the client

  Scenario: RLS allows same-tenant access
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I execute Supabase query:
      """sql
      SELECT * FROM suppliers WHERE tenant_id = 'tenant-a'
      """
    Then the query should return all suppliers for tenant-a
    And no suppliers from other tenants should be included

  Scenario: RLS works with complex joins
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I execute Supabase query:
      """sql
      SELECT s.*, e.score
      FROM suppliers s
      LEFT JOIN evaluations e ON s.id = e.supplier_id
      WHERE s.status = 'approved'
      """
    Then all returned suppliers should belong to tenant-a
    And all returned evaluations should belong to tenant-a
    And no data from other tenants should be included

  Scenario: RLS enforced even with direct tenant_id specification
    Given I am authenticated as "alice@acme.com" (Tenant A)
    When I execute Supabase query with explicit tenant filter:
      """sql
      SELECT * FROM suppliers WHERE tenant_id = 'tenant-b'
      ```
    Then the query should return zero rows
    And RLS should override the explicit filter
````

#### Technical Implementation

**RLS Policy Definition (SQL):**

```sql
-- Enable RLS on suppliers table
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only SELECT suppliers from their tenant
CREATE POLICY tenant_isolation_select ON suppliers
  FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id
      FROM users
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can only INSERT suppliers for their tenant
CREATE POLICY tenant_isolation_insert ON suppliers
  FOR INSERT
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id
      FROM users
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can only UPDATE suppliers from their tenant
CREATE POLICY tenant_isolation_update ON suppliers
  FOR UPDATE
  USING (
    tenant_id = (
      SELECT tenant_id
      FROM users
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id
      FROM users
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can only DELETE suppliers from their tenant
CREATE POLICY tenant_isolation_delete ON suppliers
  FOR DELETE
  USING (
    tenant_id = (
      SELECT tenant_id
      FROM users
      WHERE id = auth.uid()
    )
  );
```

**Automated RLS Verification Test:**

```typescript
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getTestUser, createTestSupplier } from "../helpers/fixtures";

describe("RLS Policy Verification", () => {
  it("should prevent cross-tenant SELECT via RLS", async () => {
    // Setup
    const userA = await getTestUser("alice@acme.com", "tenant-a");
    const supplierB = await createTestSupplier({ tenantId: "tenant-b" });

    // Create Supabase client with user A's JWT
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${userA.jwt}`,
          },
        },
      }
    );

    // Attempt to fetch supplier from different tenant
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierB.id);

    // Assertions
    expect(error).toBeNull(); // RLS returns empty, not error
    expect(data).toEqual([]); // Zero rows returned
  });

  it("should prevent cross-tenant INSERT via RLS", async () => {
    const userA = await getTestUser("alice@acme.com", "tenant-a");

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${userA.jwt}`,
          },
        },
      }
    );

    // Attempt to insert supplier for different tenant
    const { data, error } = await supabase.from("suppliers").insert({
      tenant_id: "tenant-b", // Different tenant!
      name: "Malicious Supplier",
      tax_id: "TAX-12345",
      category: "raw_materials",
      status: "prospect",
      contact_name: "John Doe",
      contact_email: "john@example.com",
      contact_phone: "+1234567890",
      address: {
        street: "123 Main St",
        city: "Berlin",
        postalCode: "10115",
        country: "DE",
      },
      certifications: [],
      metadata: {},
      created_by: userA.id,
    });

    // Assertions
    expect(error).toBeDefined();
    expect(error?.code).toBe("42501"); // Insufficient privilege (RLS violation)
    expect(data).toBeNull();

    // Verify no row was inserted
    const inserted = await verifySupplierNotExists(
      "tenant-b",
      "Malicious Supplier"
    );
    expect(inserted).toBe(false);
  });

  it("should allow same-tenant access", async () => {
    const userA = await getTestUser("alice@acme.com", "tenant-a");
    const supplierA = await createTestSupplier({
      tenantId: "tenant-a",
      name: "Supplier A",
    });

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${userA.jwt}`,
          },
        },
      }
    );

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierA.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(supplierA.id);
    expect(data[0].tenant_id).toBe("tenant-a");
  });
});
```

**Daily Automated RLS Verification Job:**

```typescript
// scripts/verify-rls-policies.ts
import { db } from "../src/db";
import { sendAlert } from "../src/lib/alerts";

/**
 * Daily job to verify RLS policies are correctly enforced
 * Runs via cron: 0 2 * * * (2 AM daily)
 */
export async function verifyRLSPolicies() {
  const results = {
    timestamp: new Date(),
    passed: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Test 1: Verify RLS is enabled on all tables
    const tables = ["suppliers", "evaluations", "complaints", "qualifications"];

    for (const table of tables) {
      const rlsEnabled = await db.execute(`
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = '${table}'
      `);

      if (!rlsEnabled.rows[0]?.relrowsecurity) {
        results.failed++;
        results.errors.push(`RLS not enabled on table: ${table}`);
      } else {
        results.passed++;
      }
    }

    // Test 2: Verify policy count for each table
    const expectedPolicies = 4; // SELECT, INSERT, UPDATE, DELETE

    for (const table of tables) {
      const policyCount = await db.execute(`
        SELECT COUNT(*) as count
        FROM pg_policies
        WHERE tablename = '${table}'
      `);

      const count = parseInt(policyCount.rows[0]?.count || "0");

      if (count < expectedPolicies) {
        results.failed++;
        results.errors.push(
          `Table ${table} has ${count} policies, expected ${expectedPolicies}`
        );
      } else {
        results.passed++;
      }
    }

    // Test 3: Verify cross-tenant isolation with test accounts
    const tenantA = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, "test-tenant-a"),
    });

    const tenantB = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, "test-tenant-b"),
    });

    if (tenantA && tenantB) {
      // Create test supplier in tenant B
      const [testSupplier] = await db
        .insert(suppliers)
        .values({
          tenantId: tenantB.id,
          name: "RLS Test Supplier",
          taxId: `TEST-${Date.now()}`,
          category: "raw_materials",
          status: "prospect",
          contactName: "Test",
          contactEmail: "test@example.com",
          contactPhone: "+1234567890",
          address: {
            street: "123 Main",
            city: "Berlin",
            postalCode: "10115",
            country: "DE",
          },
          certifications: [],
          metadata: {},
          createdBy: "system",
        })
        .returning();

      // Try to access from tenant A's perspective
      // (This would be done via Supabase SDK in real scenario)
      const crossTenantAccess = await db.query.suppliers.findFirst({
        where: (suppliers, { eq, and }) =>
          and(
            eq(suppliers.id, testSupplier.id),
            eq(suppliers.tenantId, tenantA.id) // Wrong tenant
          ),
      });

      if (crossTenantAccess) {
        results.failed++;
        results.errors.push("Cross-tenant access succeeded (RLS FAILURE!)");
      } else {
        results.passed++;
      }

      // Cleanup
      await db.delete(suppliers).where(eq(suppliers.id, testSupplier.id));
    }
  } catch (error) {
    results.errors.push(`Verification script error: ${error.message}`);
    results.failed++;
  }

  // Report results
  if (results.failed > 0) {
    await sendAlert({
      severity: "critical",
      title: "RLS Policy Verification Failed",
      message: `${results.failed} RLS checks failed`,
      details: results.errors,
      timestamp: results.timestamp,
    });
  }

  // Log results
  console.log("RLS Verification Results:", results);

  return results;
}

// Run if executed directly
if (import.meta.main) {
  verifyRLSPolicies().then((results) => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
```

#### Acceptance Criteria

✅ **Pass Criteria:**

- RLS enabled on all tables (suppliers, evaluations, complaints, qualifications, documents)
- All 4 policy types (SELECT, INSERT, UPDATE, DELETE) configured per table
- Cross-tenant SELECT returns zero rows (not error)
- Cross-tenant INSERT/UPDATE/DELETE fail with RLS violation
- Same-tenant operations succeed normally
- Complex joins respect RLS policies
- Daily automated verification passes
- Zero policy violations in production logs

❌ **Fail Criteria:**

- Any cross-tenant data access succeeds
- RLS disabled on any table
- Missing policies (< 4 per table)
- Same-tenant operations blocked
- Daily verification job fails

---

## 2. Bun/ElysiaJS Production Stability (HIGH RISK)

### Risk Summary

- **Impact:** HIGH (API downtime, data corruption, scaling issues)
- **Probability:** Medium-High (newer technology, limited production track record)
- **Test Priority:** P0 - Must validate in Week 1 POC

### Test Coverage Requirements

- **Load Tests:** 1000 concurrent users, 10,000 requests/min
- **Stress Tests:** 5000 concurrent users, gradual degradation
- **Endurance Tests:** 72-hour continuous operation
- **Chaos Engineering:** Random failures, network issues, database drops

---

### Scenario 2.1: High Concurrency Load Test

**Risk:** Bun runtime fails or degrades under production load levels

**Priority:** P0 - Go/No-Go decision criteria

#### Given-When-Then Specification

```gherkin
Feature: ElysiaJS API handles production load

  Scenario: API handles 1000 concurrent users
    Given the ElysiaJS API is deployed on Fly.io
    And the database has 10,000 suppliers across 50 tenants
    And Redis cache is warmed up
    When 1000 concurrent users make requests for 10 minutes:
      | Endpoint              | Method | % of Traffic |
      | /api/v1/suppliers     | GET    | 50%          |
      | /api/v1/evaluations   | GET    | 20%          |
      | /api/v1/suppliers/:id | GET    | 15%          |
      | /api/v1/suppliers     | POST   | 10%          |
      | /api/v1/evaluations   | POST   | 5%           |
    Then the API should maintain:
      | Metric                | Target         | Tolerance |
      | p95 response time     | < 500ms        | < 800ms   |
      | p99 response time     | < 1000ms       | < 1500ms  |
      | Error rate            | < 0.1%         | < 0.5%    |
      | Success rate          | > 99.9%        | > 99.5%   |
      | Memory usage          | < 80% capacity | < 90%     |
      | CPU usage             | < 70% capacity | < 85%     |
    And no memory leaks should be detected
    And no connection pool exhaustion should occur
    And all responses should be valid JSON

  Scenario: API autoscales under increasing load
    Given the API is running with 2 instances
    And load balancer is configured
    When request rate increases from 100 to 5000 req/min over 5 minutes
    Then the API should scale to 8+ instances
    And response times should remain < 1000ms (p95)
    And no 503 errors should occur
    And scale-up should complete within 60 seconds

  Scenario: API degrades gracefully under extreme load
    Given the API is running at capacity
    When request rate exceeds 10,000 req/min
    Then the API should return 503 errors with retry-after headers
    And existing requests should complete successfully
    And no crashes or restarts should occur
    And circuit breakers should activate
    And health check endpoint should return degraded status
```

#### Technical Implementation

**Load Test Configuration (k6):**

```javascript
// load-tests/high-concurrency.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const apiResponseTime = new Trend("api_response_time");

// Test configuration
export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "5m", target: 500 }, // Ramp to 500 users
    { duration: "10m", target: 1000 }, // Ramp to 1000 users
    { duration: "10m", target: 1000 }, // Stay at 1000 users
    { duration: "5m", target: 500 }, // Ramp down to 500
    { duration: "2m", target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"], // 95% < 500ms, 99% < 1s
    http_req_failed: ["rate<0.01"], // Less than 1% errors
    errors: ["rate<0.01"],
  },
};

// Test data
const BASE_URL = __ENV.API_URL || "https://api.supplex.io";
const API_TOKENS = JSON.parse(open("./test-tokens.json")); // Pre-generated tokens

export default function () {
  // Randomly select a user token
  const token = API_TOKENS[Math.floor(Math.random() * API_TOKENS.length)];
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Weighted random endpoint selection (matching traffic distribution)
  const rand = Math.random();
  let response;

  if (rand < 0.5) {
    // 50% - List suppliers
    response = http.get(`${BASE_URL}/api/v1/suppliers`, { headers });
  } else if (rand < 0.7) {
    // 20% - List evaluations
    response = http.get(`${BASE_URL}/api/v1/evaluations`, { headers });
  } else if (rand < 0.85) {
    // 15% - Get specific supplier
    const supplierId = `supplier-${Math.floor(Math.random() * 10000)}`;
    response = http.get(`${BASE_URL}/api/v1/suppliers/${supplierId}`, {
      headers,
    });
  } else if (rand < 0.95) {
    // 10% - Create supplier
    response = http.post(
      `${BASE_URL}/api/v1/suppliers`,
      JSON.stringify({
        name: `Load Test Supplier ${Date.now()}`,
        taxId: `TAX-${Date.now()}`,
        category: "raw_materials",
        status: "prospect",
        contactName: "Load Test",
        contactEmail: "loadtest@example.com",
        contactPhone: "+1234567890",
        address: {
          street: "123 Test St",
          city: "Berlin",
          postalCode: "10115",
          country: "DE",
        },
        certifications: [],
        metadata: {},
      }),
      { headers }
    );
  } else {
    // 5% - Create evaluation
    const supplierId = `supplier-${Math.floor(Math.random() * 1000)}`;
    response = http.post(
      `${BASE_URL}/api/v1/evaluations`,
      JSON.stringify({
        supplierId,
        period: "2025-Q1",
        scores: {
          quality: Math.floor(Math.random() * 5) + 1,
          delivery: Math.floor(Math.random() * 5) + 1,
          service: Math.floor(Math.random() * 5) + 1,
          cost: Math.floor(Math.random() * 5) + 1,
        },
        comments: "Load test evaluation",
      }),
      { headers }
    );
  }

  // Check response
  const success = check(response, {
    "status is 200-201": (r) => r.status >= 200 && r.status < 300,
    "response time < 500ms": (r) => r.timings.duration < 500,
    "response time < 1000ms": (r) => r.timings.duration < 1000,
    "response is JSON": (r) =>
      r.headers["Content-Type"]?.includes("application/json"),
    "no server errors": (r) => r.status < 500,
  });

  // Record metrics
  errorRate.add(!success);
  apiResponseTime.add(response.timings.duration);

  // Random think time (simulate real users)
  sleep(Math.random() * 3);
}

export function handleSummary(data) {
  return {
    "load-test-results.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
```

**Stress Test - Find Breaking Point:**

```javascript
// load-tests/stress-test.js
import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Warm up
    { duration: "5m", target: 1000 }, // Normal load
    { duration: "10m", target: 3000 }, // Push harder
    { duration: "10m", target: 5000 }, // Stress level
    { duration: "5m", target: 7000 }, // Break it!
    { duration: "5m", target: 0 }, // Recovery
  ],
  thresholds: {
    // More lenient thresholds for stress test
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.05"], // Allow 5% errors
  },
};

export default function () {
  // Same test logic as high-concurrency.js
  // ...
}
```

**Endurance Test - Memory Leak Detection:**

```javascript
// load-tests/endurance-test.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "5m", target: 500 }, // Ramp up
    { duration: "72h", target: 500 }, // Sustained load for 3 days
    { duration: "5m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  // Mix of read and write operations
  // ...
}

// Additional monitoring script to track memory over time
```

**Monitoring During Load Tests:**

```typescript
// scripts/monitor-load-test.ts
import { metrics } from "../src/lib/metrics";
import { sendAlert } from "../src/lib/alerts";

interface LoadTestMetrics {
  timestamp: Date;
  memoryUsageMB: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  activeConnections: number;
  requestsPerSecond: number;
  p95ResponseTime: number;
  errorRate: number;
}

export async function monitorLoadTest(durationMinutes: number) {
  const samples: LoadTestMetrics[] = [];
  const intervalMs = 10000; // Sample every 10 seconds
  const iterations = (durationMinutes * 60 * 1000) / intervalMs;

  console.log(
    `Starting load test monitoring for ${durationMinutes} minutes...`
  );

  for (let i = 0; i < iterations; i++) {
    try {
      const sample: LoadTestMetrics = {
        timestamp: new Date(),
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
        memoryUsagePercent:
          (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) *
          100,
        cpuUsagePercent: await metrics.getCpuUsage(),
        activeConnections: await metrics.getActiveConnections(),
        requestsPerSecond: await metrics.getRequestsPerSecond(),
        p95ResponseTime: await metrics.getP95ResponseTime(),
        errorRate: await metrics.getErrorRate(),
      };

      samples.push(sample);

      // Check for anomalies
      if (sample.memoryUsagePercent > 90) {
        await sendAlert({
          severity: "critical",
          title: "Memory usage critical during load test",
          message: `Memory usage: ${sample.memoryUsagePercent.toFixed(2)}%`,
          details: sample,
        });
      }

      if (sample.errorRate > 0.05) {
        await sendAlert({
          severity: "high",
          title: "Error rate elevated during load test",
          message: `Error rate: ${(sample.errorRate * 100).toFixed(2)}%`,
          details: sample,
        });
      }

      // Detect memory leak (increasing trend)
      if (samples.length >= 30) {
        // Need 5 minutes of data
        const recentSamples = samples.slice(-30);
        const avgMemoryGrowth = calculateMemoryGrowthRate(recentSamples);

        if (avgMemoryGrowth > 0.5) {
          // >0.5% growth per sample
          await sendAlert({
            severity: "high",
            title: "Potential memory leak detected",
            message: `Memory growing at ${avgMemoryGrowth.toFixed(3)}% per 10s`,
            details: { recentSamples: recentSamples.slice(-10) },
          });
        }
      }

      // Log sample
      console.log(
        `[${sample.timestamp.toISOString()}] ` +
          `Mem: ${sample.memoryUsageMB.toFixed(
            0
          )}MB (${sample.memoryUsagePercent.toFixed(1)}%) | ` +
          `CPU: ${sample.cpuUsagePercent.toFixed(1)}% | ` +
          `Conns: ${sample.activeConnections} | ` +
          `RPS: ${sample.requestsPerSecond.toFixed(0)} | ` +
          `P95: ${sample.p95ResponseTime.toFixed(0)}ms | ` +
          `Errors: ${(sample.errorRate * 100).toFixed(2)}%`
      );
    } catch (error) {
      console.error("Monitoring error:", error);
    }

    // Wait for next sample
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // Generate report
  const report = generateLoadTestReport(samples);
  console.log("\n=== Load Test Report ===");
  console.log(JSON.stringify(report, null, 2));

  return { samples, report };
}

function calculateMemoryGrowthRate(samples: LoadTestMetrics[]): number {
  if (samples.length < 2) return 0;

  const first = samples[0].memoryUsagePercent;
  const last = samples[samples.length - 1].memoryUsagePercent;
  const growth = last - first;

  return growth / samples.length; // Average growth per sample
}

function generateLoadTestReport(samples: LoadTestMetrics[]) {
  return {
    duration: samples.length * 10, // seconds
    memory: {
      min: Math.min(...samples.map((s) => s.memoryUsagePercent)),
      max: Math.max(...samples.map((s) => s.memoryUsagePercent)),
      avg:
        samples.reduce((sum, s) => sum + s.memoryUsagePercent, 0) /
        samples.length,
      final: samples[samples.length - 1]?.memoryUsagePercent,
    },
    cpu: {
      min: Math.min(...samples.map((s) => s.cpuUsagePercent)),
      max: Math.max(...samples.map((s) => s.cpuUsagePercent)),
      avg:
        samples.reduce((sum, s) => sum + s.cpuUsagePercent, 0) / samples.length,
    },
    performance: {
      avgP95ResponseTime:
        samples.reduce((sum, s) => sum + s.p95ResponseTime, 0) / samples.length,
      maxP95ResponseTime: Math.max(...samples.map((s) => s.p95ResponseTime)),
      avgErrorRate:
        samples.reduce((sum, s) => sum + s.errorRate, 0) / samples.length,
      maxErrorRate: Math.max(...samples.map((s) => s.errorRate)),
    },
    throughput: {
      avgRPS:
        samples.reduce((sum, s) => sum + s.requestsPerSecond, 0) /
        samples.length,
      maxRPS: Math.max(...samples.map((s) => s.requestsPerSecond)),
    },
  };
}
```

#### Acceptance Criteria

✅ **Pass Criteria (Go Decision):**

- 1000 concurrent users: p95 < 500ms, error rate < 0.1%
- 5000 concurrent users (stress): p95 < 2s, error rate < 5%
- 72-hour endurance: memory stable (no growth >2%), no crashes
- Autoscaling works: scales to 8+ instances, <60s scale-up time
- Graceful degradation: returns 503 (not 500), no data corruption
- Zero memory leaks detected
- CPU usage < 85% under sustained load

❌ **Fail Criteria (No-Go Decision):**

- p95 response time > 1s at 1000 users
- Error rate > 1% at normal load
- Memory leaks detected (>5% growth over 24hrs)
- Crashes or restarts under load
- Data corruption under concurrency
- Cannot autoscale or scale-up takes >2min
- CPU pegged at 100% (indicates bottleneck)

**Alternative Stack Trigger:**
If 2+ fail criteria met → Evaluate Node.js + NestJS fallback

---

### Scenario 2.2: Database Connection Pool Stability

**Risk:** Bun's database connection handling causes issues under load

**Priority:** P0

#### Given-When-Then Specification

```gherkin
Feature: Database connection pool remains stable under load

  Scenario: Connection pool handles concurrent queries
    Given the connection pool is configured with:
      | Setting        | Value |
      | min_size       | 5     |
      | max_size       | 20    |
      | timeout        | 5000ms|
      | idle_timeout   | 30000ms|
    When 100 concurrent API requests require database access
    Then all connections should be acquired within 1000ms
    And no connection timeouts should occur
    And connections should be properly released after use
    And pool size should not exceed max_size
    And no connection leaks should be detected

  Scenario: Connection pool recovers from database disconnect
    Given the API is handling normal traffic
    And the connection pool has 10 active connections
    When the database connection is temporarily lost for 10 seconds
    Then existing queries should timeout gracefully
    And API should return 503 errors with proper error messages
    And connection pool should attempt reconnection
    When the database connection is restored
    Then the connection pool should recover within 30 seconds
    And API should resume normal operations
    And no manual intervention should be required

  Scenario: Long-running queries don't exhaust connection pool
    Given the connection pool max_size is 20
    When 10 concurrent requests trigger slow queries (>5 seconds)
    And 50 concurrent requests trigger fast queries (<100ms)
    Then fast queries should complete without waiting for slow queries
    And connection pool should not be exhausted
    And slow queries should timeout after 10 seconds
    And error messages should indicate query timeout (not connection timeout)
```

#### Technical Implementation

```typescript
// tests/integration/database-connection-pool.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, closeDatabase } from "../../src/db";
import { testClient } from "../helpers/test-client";

describe("Database connection pool stability", () => {
  it("should handle 100 concurrent queries without timeout", async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      db.query.suppliers.findMany({
        where: (suppliers, { eq }) => eq(suppliers.tenantId, "test-tenant"),
        limit: 10,
      })
    );

    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(5000); // All queries in <5s

    // Verify no connection leaks
    const poolStatus = await db.execute(
      "SELECT count(*) FROM pg_stat_activity"
    );
    expect(parseInt(poolStatus.rows[0].count)).toBeLessThanOrEqual(20); // max_size
  });

  it("should recover from database disconnect", async () => {
    // Simulate database disconnect
    await db.execute(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid()"
    );

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Attempt query (should fail initially)
    try {
      await db.query.suppliers.findMany({ limit: 1 });
      expect.fail("Query should have failed");
    } catch (error) {
      expect(error.message).toContain("connection");
    }

    // Wait for reconnection
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify recovery
    const result = await db.query.suppliers.findMany({ limit: 1 });
    expect(result).toBeDefined();
  });

  it("should not exhaust pool with long-running queries", async () => {
    // Start 5 slow queries (simulate with pg_sleep)
    const slowQueries = Array.from({ length: 5 }, () =>
      db.execute("SELECT pg_sleep(5)")
    );

    // Start 20 fast queries
    const fastQueries = Array.from({ length: 20 }, () =>
      db.query.suppliers.findMany({ limit: 1 })
    );

    // Fast queries should complete before slow queries
    const start = Date.now();
    await Promise.all(fastQueries);
    const fastDuration = Date.now() - start;

    expect(fastDuration).toBeLessThan(2000); // Fast queries don't wait

    // Cleanup slow queries
    await Promise.all(slowQueries);
  });
});
```

#### Acceptance Criteria

✅ **Pass Criteria:**

- 100 concurrent queries complete in <5s
- Zero connection timeouts under normal load
- Connection pool recovers from DB disconnect in <30s
- Fast queries not blocked by slow queries
- No connection leaks (verified via pg_stat_activity)
- Proper error handling for connection failures

❌ **Fail Criteria:**

- Connection timeouts under normal load
- Connection leaks detected
- Cannot recover from DB disconnect
- Fast queries blocked by slow queries

---

## 3. Qualification Workflow State Management (MEDIUM-HIGH RISK)

### Risk Summary

- **Impact:** MEDIUM (business process failure, compliance issues)
- **Probability:** Medium (complex state machine, many edge cases)
- **Test Priority:** P1 - Critical business workflow

### Test Coverage Requirements

- **State Transition Tests:** 100% coverage of all state transitions
- **Edge Case Tests:** All 15+ edge cases from frontend spec
- **Integration Tests:** End-to-end workflow scenarios
- **Audit Trail Tests:** Complete traceability verification

---

### Scenario 3.1: Qualification Workflow Happy Path

**Risk:** Core workflow fails to complete successfully

**Priority:** P1 - Critical business function

#### Given-When-Then Specification

```gherkin
Feature: Supplier Qualification Workflow

  Background:
    Given the following users exist:
      | Email                  | Role                | Tenant ID |
      | requestor@acme.com     | procurement_manager | tenant-a  |
      | procurement@acme.com   | procurement_manager | tenant-a  |
      | quality@acme.com       | quality_manager     | tenant-a  |
    And the following qualification stages are configured:
      | Stage | Approver Role       | Order |
      | 1     | procurement_manager | 1     |
      | 2     | procurement_manager | 2     |
      | 3     | quality_manager     | 3     |

  Scenario: Complete qualification workflow from prospect to approved
    Given I am authenticated as "requestor@acme.com"

    # Step 1: Create supplier (Prospect)
    When I POST "/api/v1/suppliers" with:
      """json
      {
        "name": "New Supplier Corp",
        "taxId": "TAX-NS-001",
        "category": "raw_materials",
        "contactName": "John Supplier",
        "contactEmail": "john@newsupplier.com",
        "contactPhone": "+49301234567",
        "address": {
          "street": "Industriestr. 1",
          "city": "Berlin",
          "postalCode": "10115",
          "country": "DE"
        }
      }
      """
    Then the response status should be 201
    And the supplier status should be "prospect"
    And an activity log entry should be created:
      | Field  | Value                 |
      | action | SUPPLIER_CREATED      |
      | userId | <requestor-user-id>   |
      | before | null                  |
      | after  | {"status": "prospect"}|

    # Step 2: Upload required documents
    When I POST "/api/v1/suppliers/<supplier-id>/documents" with files:
      | Filename          | Type                | Size |
      | iso-9001-cert.pdf | ISO_9001_CERTIFICATE| 2MB  |
      | tax-form.pdf      | TAX_DOCUMENTATION   | 1MB  |
    Then the response status should be 201
    And 2 documents should be attached to the supplier
    And each document should have:
      | Field        | Value |
      | uploaded_by  | <requestor-user-id> |
      | version      | 1     |
      | virus_scanned| true  |

    # Step 3: Submit for approval
    When I POST "/api/v1/suppliers/<supplier-id>/submit-qualification"
    Then the response status should be 200
    And the supplier status should be "qualification_in_progress"
    And the qualification workflow should be in state "stage_1_pending"
    And an email notification should be sent to "procurement@acme.com"
    And the notification should contain:
      | Field   | Value                              |
      | subject | New supplier awaiting your approval|
      | body    | contains supplier name             |
      | action_url| /qualifications/<qual-id>/approve|

    # Step 4: Stage 1 approval
    Given I am now authenticated as "procurement@acme.com"
    When I POST "/api/v1/qualifications/<qual-id>/approve" with:
      """json
      {
        "stage": 1,
        "comments": "Supplier documentation complete and verified"
      }
      """
    Then the response status should be 200
    And the qualification workflow should be in state "stage_2_pending"
    And stage 1 should have:
      | Field         | Value                           |
      | status        | approved                        |
      | approved_by   | <procurement-user-id>           |
      | approved_at   | <current-timestamp>             |
      | comments      | Supplier documentation complete...|
    And an email notification should be sent to the next approver
    And an activity log entry should be created with action "STAGE_1_APPROVED"

    # Step 5: Stage 2 approval (same role, different person or auto)
    # For MVP: Assuming same user can approve stage 2
    When I POST "/api/v1/qualifications/<qual-id>/approve" with:
      """json
      {
        "stage": 2,
        "comments": "Commercial terms negotiated and acceptable"
      }
      """
    Then the response status should be 200
    And the qualification workflow should be in state "stage_3_pending"
    And an email notification should be sent to "quality@acme.com"

    # Step 6: Stage 3 approval (Quality Manager)
    Given I am now authenticated as "quality@acme.com"
    When I POST "/api/v1/qualifications/<qual-id>/approve" with:
      """json
      {
        "stage": 3,
        "comments": "Quality systems audit completed - approved for manufacturing supplies"
      }
      """
    Then the response status should be 200
    And the supplier status should be "approved"
    And the qualification workflow should be in state "completed"
    And all 3 stages should have status "approved"
    And an email notification should be sent to:
      | Recipient              | Subject                      |
      | requestor@acme.com     | Supplier qualification approved|
      | procurement@acme.com   | Supplier qualification approved|
      | quality@acme.com       | Supplier qualification approved|
      | john@newsupplier.com   | You have been approved as supplier|
    And an activity log entry should be created with action "QUALIFICATION_COMPLETED"
    And the complete audit trail should contain exactly 7 entries:
      | Action                    |
      | SUPPLIER_CREATED          |
      | DOCUMENT_UPLOADED         |
      | DOCUMENT_UPLOADED         |
      | QUALIFICATION_SUBMITTED   |
      | STAGE_1_APPROVED          |
      | STAGE_2_APPROVED          |
      | STAGE_3_APPROVED          |
```

#### Technical Implementation

```typescript
// tests/integration/qualification-workflow.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { testClient } from "../helpers/test-client";
import { createTestTenant, createTestUser } from "../helpers/fixtures";
import { getAuthToken } from "../helpers/auth";
import { waitForEmail } from "../helpers/email-mock";
import { getActivityLogs } from "../helpers/audit";

describe("Qualification Workflow: Happy Path", () => {
  let tenant: any;
  let requestor: any, procurement: any, quality: any;
  let requestorToken: string;
  let supplierId: string;
  let qualificationId: string;

  beforeEach(async () => {
    // Setup test data
    tenant = await createTestTenant({ name: "Acme Manufacturing" });

    requestor = await createTestUser({
      email: "requestor@acme.com",
      tenantId: tenant.id,
      role: "procurement_manager",
    });

    procurement = await createTestUser({
      email: "procurement@acme.com",
      tenantId: tenant.id,
      role: "procurement_manager",
    });

    quality = await createTestUser({
      email: "quality@acme.com",
      tenantId: tenant.id,
      role: "quality_manager",
    });

    requestorToken = await getAuthToken(requestor.email);
  });

  it("should complete full qualification workflow from prospect to approved", async () => {
    // Step 1: Create supplier
    const createResponse = await testClient
      .post("/api/v1/suppliers")
      .set("Authorization", `Bearer ${requestorToken}`)
      .send({
        name: "New Supplier Corp",
        taxId: "TAX-NS-001",
        category: "raw_materials",
        contactName: "John Supplier",
        contactEmail: "john@newsupplier.com",
        contactPhone: "+49301234567",
        address: {
          street: "Industriestr. 1",
          city: "Berlin",
          postalCode: "10115",
          country: "DE",
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.status).toBe("prospect");

    supplierId = createResponse.body.data.id;

    // Verify activity log
    const logs = await getActivityLogs({ resourceId: supplierId });
    expect(logs).toContainEqual(
      expect.objectContaining({
        action: "SUPPLIER_CREATED",
        userId: requestor.id,
        resourceType: "supplier",
        resourceId: supplierId,
      })
    );

    // Step 2: Upload documents
    const doc1 = await testClient
      .post(`/api/v1/suppliers/${supplierId}/documents`)
      .set("Authorization", `Bearer ${requestorToken}`)
      .attach("file", "./test-fixtures/iso-9001-cert.pdf")
      .field("type", "ISO_9001_CERTIFICATE");

    expect(doc1.status).toBe(201);

    const doc2 = await testClient
      .post(`/api/v1/suppliers/${supplierId}/documents`)
      .set("Authorization", `Bearer ${requestorToken}`)
      .attach("file", "./test-fixtures/tax-form.pdf")
      .field("type", "TAX_DOCUMENTATION");

    expect(doc2.status).toBe(201);

    // Step 3: Submit for qualification
    const submitResponse = await testClient
      .post(`/api/v1/suppliers/${supplierId}/submit-qualification`)
      .set("Authorization", `Bearer ${requestorToken}`)
      .send();

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.data.supplier.status).toBe(
      "qualification_in_progress"
    );
    expect(submitResponse.body.data.workflow.state).toBe("stage_1_pending");

    qualificationId = submitResponse.body.data.workflow.id;

    // Verify email sent to stage 1 approver
    const email = await waitForEmail({
      to: procurement.email,
      subject: /awaiting your approval/i,
      timeoutMs: 5000,
    });
    expect(email).toBeDefined();
    expect(email.body).toContain("New Supplier Corp");

    // Step 4: Stage 1 approval
    const procurementToken = await getAuthToken(procurement.email);

    const stage1Response = await testClient
      .post(`/api/v1/qualifications/${qualificationId}/approve`)
      .set("Authorization", `Bearer ${procurementToken}`)
      .send({
        stage: 1,
        comments: "Supplier documentation complete and verified",
      });

    expect(stage1Response.status).toBe(200);
    expect(stage1Response.body.data.workflow.state).toBe("stage_2_pending");
    expect(stage1Response.body.data.workflow.stages[0]).toMatchObject({
      stage: 1,
      status: "approved",
      approvedBy: procurement.id,
      comments: "Supplier documentation complete and verified",
    });

    // Step 5: Stage 2 approval
    const stage2Response = await testClient
      .post(`/api/v1/qualifications/${qualificationId}/approve`)
      .set("Authorization", `Bearer ${procurementToken}`)
      .send({
        stage: 2,
        comments: "Commercial terms negotiated and acceptable",
      });

    expect(stage2Response.status).toBe(200);
    expect(stage2Response.body.data.workflow.state).toBe("stage_3_pending");

    // Verify email to quality manager
    const qualityEmail = await waitForEmail({
      to: quality.email,
      subject: /awaiting your approval/i,
      timeoutMs: 5000,
    });
    expect(qualityEmail).toBeDefined();

    // Step 6: Stage 3 approval (Quality Manager)
    const qualityToken = await getAuthToken(quality.email);

    const stage3Response = await testClient
      .post(`/api/v1/qualifications/${qualificationId}/approve`)
      .set("Authorization", `Bearer ${qualityToken}`)
      .send({
        stage: 3,
        comments: "Quality systems audit completed - approved",
      });

    expect(stage3Response.status).toBe(200);
    expect(stage3Response.body.data.supplier.status).toBe("approved");
    expect(stage3Response.body.data.workflow.state).toBe("completed");
    expect(stage3Response.body.data.workflow.stages).toHaveLength(3);
    expect(
      stage3Response.body.data.workflow.stages.every(
        (s: any) => s.status === "approved"
      )
    ).toBe(true);

    // Verify completion emails
    const completionEmails = await waitForEmail({
      to: [
        requestor.email,
        procurement.email,
        quality.email,
        "john@newsupplier.com",
      ],
      subject: /approved/i,
      timeoutMs: 5000,
    });
    expect(completionEmails).toHaveLength(4);

    // Verify complete audit trail
    const finalLogs = await getActivityLogs({ resourceId: supplierId });
    expect(finalLogs).toHaveLength(7);
    expect(finalLogs.map((l: any) => l.action)).toEqual([
      "SUPPLIER_CREATED",
      "DOCUMENT_UPLOADED",
      "DOCUMENT_UPLOADED",
      "QUALIFICATION_SUBMITTED",
      "STAGE_1_APPROVED",
      "STAGE_2_APPROVED",
      "STAGE_3_APPROVED",
    ]);
  });
});
```

#### Acceptance Criteria

✅ **Pass Criteria:**

- Supplier transitions: prospect → qualification_in_progress → approved
- All 3 stages complete in order
- Email notifications sent at each stage transition
- Complete audit trail (7 entries for happy path)
- All timestamps recorded
- Approver information captured
- Comments stored correctly
- Documents attached and verified
- Supplier notified on approval

❌ **Fail Criteria:**

- Workflow stuck in any stage
- Missing email notifications
- Incomplete audit trail
- Stage order not enforced
- Concurrent approval conflicts
- Data loss during transitions

---

### Scenario 3.2: Qualification Workflow Rejection Paths

**Risk:** Rejection handling fails, workflow stuck, audit trail incomplete

**Priority:** P1

#### Given-When-Then Specification

```gherkin
Feature: Qualification workflow rejection handling

  Scenario: Rejection at Stage 1 returns to requestor
    Given a supplier in "qualification_in_progress" status
    And the workflow is at "stage_1_pending"
    When the stage 1 approver rejects with:
      """json
      {
        "stage": 1,
        "action": "reject",
        "comments": "Missing ISO 9001 certificate expiration date"
      }
      """
    Then the response status should be 200
    And the supplier status should remain "qualification_in_progress"
    And the workflow state should be "returned_to_requestor"
    And stage 1 should have status "rejected"
    And an email notification should be sent to the requestor with:
      | Field        | Value                                    |
      | subject      | Supplier qualification returned for revision|
      | body_contains| Missing ISO 9001 certificate expiration date|
      | action_url   | /suppliers/<id>/edit                     |
    And the requestor should be able to edit the supplier
    And the requestor should be able to resubmit after corrections

  Scenario: Rejection at Stage 3 preserves earlier approvals
    Given a supplier in "qualification_in_progress" status
    And stage 1 is "approved"
    And stage 2 is "approved"
    And the workflow is at "stage_3_pending"
    When the quality manager rejects with:
      """json
      {
        "stage": 3,
        "action": "reject",
        "comments": "Failed on-site audit - production equipment insufficient"
      }
      """
    Then the supplier status should remain "qualification_in_progress"
    And the workflow state should be "returned_to_requestor"
    And stage 1 status should still be "approved"
    And stage 2 status should still be "approved"
    And stage 3 status should be "rejected"
    And the requestor can resubmit after corrections
    When the requestor resubmits the qualification
    Then the workflow should restart at stage 1
    And previous approvals should be marked as "superseded"
    And new approval cycle should begin

  Scenario: Multiple rejection cycles tracked in audit log
    Given a supplier has been rejected twice and approved once
    When I retrieve the audit log for this supplier
    Then the log should show:
      | Cycle | Action               | Stage | Approver    | Outcome  |
      | 1     | QUALIFICATION_SUBMITTED| -     | Requestor   | -        |
      | 1     | STAGE_1_REJECTED     | 1     | Procurement | Rejected |
      | 2     | QUALIFICATION_RESUBMITTED| -   | Requestor   | -        |
      | 2     | STAGE_1_APPROVED     | 1     | Procurement | Approved |
      | 2     | STAGE_2_REJECTED     | 2     | Procurement | Rejected |
      | 3     | QUALIFICATION_RESUBMITTED| -   | Requestor   | -        |
      | 3     | STAGE_1_APPROVED     | 1     | Procurement | Approved |
      | 3     | STAGE_2_APPROVED     | 2     | Procurement | Approved |
      | 3     | STAGE_3_APPROVED     | 3     | Quality     | Approved |
    And each rejection should link to subsequent resubmission
```

#### Technical Implementation

```typescript
// tests/integration/qualification-workflow-rejection.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { testClient } from "../helpers/test-client";
import { createQualificationInProgress } from "../helpers/fixtures";
import { getAuthToken } from "../helpers/auth";
import { waitForEmail } from "../helpers/email-mock";

describe("Qualification Workflow: Rejection Paths", () => {
  it("should handle rejection at stage 1 and return to requestor", async () => {
    const { supplier, workflow, requestor, procurement } =
      await createQualificationInProgress({ stage: 1 });

    const procurementToken = await getAuthToken(procurement.email);

    // Reject at stage 1
    const rejectResponse = await testClient
      .post(`/api/v1/qualifications/${workflow.id}/reject`)
      .set("Authorization", `Bearer ${procurementToken}`)
      .send({
        stage: 1,
        comments: "Missing ISO 9001 certificate expiration date",
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.workflow.state).toBe(
      "returned_to_requestor"
    );
    expect(rejectResponse.body.data.workflow.stages[0].status).toBe("rejected");

    // Verify supplier can be edited
    const requestorToken = await getAuthToken(requestor.email);
    const editResponse = await testClient
      .put(`/api/v1/suppliers/${supplier.id}`)
      .set("Authorization", `Bearer ${requestorToken}`)
      .send({ name: "Updated Supplier Name" });

    expect(editResponse.status).toBe(200);

    // Verify email sent to requestor
    const email = await waitForEmail({
      to: requestor.email,
      subject: /returned for revision/i,
    });
    expect(email.body).toContain(
      "Missing ISO 9001 certificate expiration date"
    );
  });

  it("should preserve earlier approvals when rejected at stage 3", async () => {
    const { supplier, workflow, requestor, quality } =
      await createQualificationInProgress({
        stage: 3,
        previousApprovals: [
          { stage: 1, status: "approved" },
          { stage: 2, status: "approved" },
        ],
      });

    const qualityToken = await getAuthToken(quality.email);

    // Reject at stage 3
    const rejectResponse = await testClient
      .post(`/api/v1/qualifications/${workflow.id}/reject`)
      .set("Authorization", `Bearer ${qualityToken}`)
      .send({
        stage: 3,
        comments: "Failed on-site audit - production equipment insufficient",
      });

    expect(rejectResponse.status).toBe(200);

    const stages = rejectResponse.body.data.workflow.stages;
    expect(stages[0].status).toBe("approved"); // Stage 1 preserved
    expect(stages[1].status).toBe("approved"); // Stage 2 preserved
    expect(stages[2].status).toBe("rejected"); // Stage 3 rejected

    // Verify requestor can resubmit
    const requestorToken = await getAuthToken(requestor.email);
    const resubmitResponse = await testClient
      .post(`/api/v1/qualifications/${workflow.id}/resubmit`)
      .set("Authorization", `Bearer ${requestorToken}`)
      .send();

    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.data.workflow.state).toBe("stage_1_pending");

    // Previous approvals marked as superseded
    expect(resubmitResponse.body.data.workflow.previousCycles).toHaveLength(1);
  });

  it("should track multiple rejection cycles in audit log", async () => {
    // This is an integration test that simulates multiple rejection/resubmission cycles
    // Full implementation would be lengthy, but key assertions:

    const { supplier, workflow, requestor, procurement } =
      await createQualificationInProgress({ stage: 1 });

    // Cycle 1: Reject at stage 1
    await rejectQualification(workflow.id, procurement, 1, "Missing docs");
    await resubmitQualification(workflow.id, requestor);

    // Cycle 2: Approve stage 1, reject at stage 2
    await approveQualification(workflow.id, procurement, 1);
    await rejectQualification(
      workflow.id,
      procurement,
      2,
      "Commercial terms unacceptable"
    );
    await resubmitQualification(workflow.id, requestor);

    // Cycle 3: Approve all stages
    await approveQualification(workflow.id, procurement, 1);
    await approveQualification(workflow.id, procurement, 2);
    await approveQualification(workflow.id, quality, 3);

    // Verify audit log
    const auditLog = await getActivityLogs({ resourceId: supplier.id });

    expect(auditLog).toContainEqual(
      expect.objectContaining({ action: "STAGE_1_REJECTED", cycle: 1 })
    );
    expect(auditLog).toContainEqual(
      expect.objectContaining({ action: "STAGE_2_REJECTED", cycle: 2 })
    );
    expect(auditLog).toContainEqual(
      expect.objectContaining({ action: "QUALIFICATION_COMPLETED", cycle: 3 })
    );
  });
});
```

#### Acceptance Criteria

✅ **Pass Criteria:**

- Rejection at any stage returns to requestor
- Email notifications include rejection reason
- Earlier stage approvals preserved
- Requestor can edit and resubmit
- Resubmission creates new cycle
- Complete audit trail with cycle tracking
- Rejection reasons stored and displayed

❌ **Fail Criteria:**

- Workflow stuck after rejection
- Earlier approvals lost
- Cannot resubmit after rejection
- Missing rejection notifications
- Audit trail incomplete or confusing
- Rejection reason not captured

---

## Summary & Test Execution Plan

### Test Execution Phases

#### Phase 1: Pre-Development (Week 1)

- ✅ Bun/ElysiaJS POC load tests (Scenario 2.1)
- ✅ Database connection pool validation (Scenario 2.2)
- ✅ Go/No-Go decision for tech stack

#### Phase 2: During Development (Weeks 3-14)

- ✅ Multi-tenant isolation unit tests (Scenario 1.1 - unit level)
- ✅ RLS policy verification (Scenario 1.2)
- ✅ Qualification workflow integration tests (Scenarios 3.1, 3.2)
- ✅ All tests run in CI/CD pipeline

#### Phase 3: Pre-Launch (Weeks 15-16)

- ✅ Full security audit (Scenario 1.1 - penetration testing)
- ✅ Load testing at scale (Scenario 2.1 - 1000+ users)
- ✅ Endurance testing (Scenario 2.2 - 72 hours)
- ✅ E2E workflow testing with pilot users

#### Phase 4: Production Monitoring (Ongoing)

- ✅ Daily RLS verification job (automated)
- ✅ Continuous performance monitoring
- ✅ Security alert response procedures
- ✅ Quarterly penetration testing

### Coverage Targets

| Risk Area              | Unit | Integration | E2E  | Security |
| ---------------------- | ---- | ----------- | ---- | -------- |
| Multi-Tenant Isolation | 95%  | 100%        | 100% | 100%     |
| Bun/ElysiaJS Stability | N/A  | 90%         | 80%  | N/A      |
| Qualification Workflow | 85%  | 100%        | 100% | 80%      |

### Defect Severity Definitions

- **P0 (Blocker):** Data breach, system crash, data corruption
- **P1 (Critical):** Core workflow broken, major security flaw
- **P2 (Major):** Important feature broken, performance degradation
- **P3 (Minor):** Minor bug, cosmetic issue, edge case

### Exit Criteria for MVP Launch

✅ **Must Pass:**

- Zero P0 bugs
- < 3 P1 bugs (with mitigation plan)
- All multi-tenant isolation tests passing
- Load testing targets met (1000 concurrent users)
- Security audit passed
- RLS verification automated and passing
- All critical workflows tested end-to-end

---

**Document Status:** Complete - Ready for Test Implementation  
**Next Steps:** Create test automation framework, implement scenarios in CI/CD pipeline  
**Review Cycle:** Weekly during development, daily during pre-launch
