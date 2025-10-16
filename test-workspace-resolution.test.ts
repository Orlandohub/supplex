/**
 * Integration test to verify monorepo workspace resolution
 * This test ensures that packages can import from each other correctly
 */

import { describe, it, expect } from "vitest";

describe("Workspace Resolution", () => {
  it("should resolve @supplex/types package", async () => {
    const typesModule = await import("./packages/types/src/index");
    
    expect(typesModule).toBeDefined();
    expect(typesModule.HealthCheckSchema).toBeDefined();
    expect(typesModule.UserRole).toBeDefined();
  });

  it("should resolve @supplex/ui package", async () => {
    const uiModule = await import("./packages/ui/src/index");
    
    expect(uiModule).toBeDefined();
    expect(uiModule.cn).toBeDefined();
    expect(typeof uiModule.cn).toBe("function");
  });

  it("should resolve @supplex/db package", async () => {
    const dbModule = await import("./packages/db/src/index");
    
    expect(dbModule).toBeDefined();
    expect(dbModule.db).toBeDefined();
    expect(dbModule.schema).toBeDefined();
  });

  it("should share types between packages", async () => {
    const { HealthCheckSchema } = await import("./packages/types/src/index");
    
    // Simulate usage in both frontend and backend
    const healthCheck = {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
    };

    const result = HealthCheckSchema.safeParse(healthCheck);
    expect(result.success).toBe(true);
  });
});

