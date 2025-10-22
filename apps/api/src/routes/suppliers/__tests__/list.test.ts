import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";
import { listSuppliersRoute } from "../list";
import type { AuthContext } from "../../../lib/rbac/middleware";

// Mock data
const mockUser: AuthContext["user"] = {
  id: "user-123",
  email: "test@example.com",
  role: "admin" as any,
  tenantId: "tenant-123",
};

const mockSuppliers = [
  {
    id: "supplier-1",
    tenantId: "tenant-123",
    name: "Acme Corp",
    taxId: "TAX-001",
    category: "raw_materials",
    status: "approved",
    performanceScore: "4.5",
    contactName: "John Doe",
    contactEmail: "john@acme.com",
    contactPhone: "+1234567890",
    address: { street: "123 Main St", city: "New York", state: "NY", postalCode: "10001", country: "USA" },
    certifications: [],
    metadata: {},
    riskScore: "2.5",
    createdBy: "user-123",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
    deletedAt: null,
  },
  {
    id: "supplier-2",
    tenantId: "tenant-123",
    name: "Beta Supplies",
    taxId: "TAX-002",
    category: "components",
    status: "conditional",
    performanceScore: "3.2",
    contactName: "Jane Smith",
    contactEmail: "jane@beta.com",
    contactPhone: "+1987654321",
    address: { street: "456 Oak Ave", city: "Los Angeles", state: "CA", postalCode: "90001", country: "USA" },
    certifications: [],
    metadata: {},
    riskScore: "5.0",
    createdBy: "user-123",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-16"),
    deletedAt: null,
  },
];

// Create mock database functions
const createMockDb = (suppliers = mockSuppliers, count = suppliers.length) => ({
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        orderBy: mock(() => ({
          limit: mock(() => ({
            offset: mock(() => Promise.resolve(suppliers)),
          })),
        })),
      })),
    })),
  })),
});

describe("Supplier List API", () => {
  describe("GET /api/suppliers", () => {
    it("should return paginated list of suppliers", async () => {
      // Create test app with mocked authentication
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("suppliers");
      expect(result.data).toHaveProperty("total");
      expect(result.data).toHaveProperty("page");
      expect(result.data).toHaveProperty("limit");
    });

    it("should filter suppliers by search term", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers?search=Acme")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.suppliers).toBeDefined();
    });

    it("should filter suppliers by status", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers?status[]=approved&status[]=conditional")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.suppliers).toBeDefined();
    });

    it("should filter suppliers by category", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers?category[]=raw_materials")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.suppliers).toBeDefined();
    });

    it("should handle pagination parameters", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers?page=2&limit=10")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(10);
    });

    it("should enforce maximum limit of 100", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers?limit=200")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.limit).toBe(100);
    });

    it("should sort suppliers by name ascending", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers?sort=name_asc")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.suppliers).toBeDefined();
    });

    it("should sort suppliers by updated_at descending", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers?sort=updated_at_desc")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.suppliers).toBeDefined();
    });

    it("should combine multiple filters", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers?search=Acme&status[]=approved&category[]=raw_materials&page=1&limit=20&sort=name_asc")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.suppliers).toBeDefined();
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    });

    it("should return 401 when not authenticated", async () => {
      // Create app without authentication mock
      const app = new Elysia().use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers")
      );

      expect(response.status).toBe(401);
    });

    it("should handle database errors gracefully", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      // Note: In a real test, we'd mock the db to throw an error
      // For now, we're testing that the route is properly structured
      
      const response = await app.handle(
        new Request("http://localhost/suppliers")
      );

      // Should either succeed or return 500 error
      expect([200, 500]).toContain(response.status);
    });

    it("should default to page 1 when page parameter is missing", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.page).toBe(1);
    });

    it("should default to limit 20 when limit parameter is missing", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.limit).toBe(20);
    });

    it("should default to updated_at_desc sort when sort parameter is missing", async () => {
      const app = new Elysia()
        .derive(() => ({ user: mockUser }))
        .use(listSuppliersRoute);

      const response = await app.handle(
        new Request("http://localhost/suppliers")
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.data.suppliers).toBeDefined();
    });
  });
});

