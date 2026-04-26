import { describe, it, expect } from "bun:test";
import app from "../../index";

describe("Backend Health Check", () => {
  it("should return 200 OK with health status when database is connected", async () => {
    const response = await app.handle(
      new Request("http://localhost:3001/api/health")
    );

    expect(response.status).toBe(200);

    const data: any = await response.json();
    expect(data).toMatchObject({
      status: "ok",
      service: "api",
      version: "1.0.0",
    });
    expect(data.timestamp).toBeDefined();
    expect(data.checks.database).toBe("connected");
  });

  it("should include environment information", async () => {
    const response = await app.handle(
      new Request("http://localhost:3001/api/health")
    );

    const data: any = await response.json();
    expect(data.environment).toBeDefined();
  });

  it("should include service name", async () => {
    const response = await app.handle(
      new Request("http://localhost:3001/api/health")
    );

    const data: any = await response.json();
    expect(data.service).toBe("api");
  });

  it("should include database check status", async () => {
    const response = await app.handle(
      new Request("http://localhost:3001/api/health")
    );

    const data: any = await response.json();
    expect(data.checks).toBeDefined();
    expect(data.checks.database).toBeDefined();
    expect(["connected", "disconnected", "unknown"]).toContain(
      data.checks.database
    );
  });

  it("should have valid timestamp format", async () => {
    const response = await app.handle(
      new Request("http://localhost:3001/api/health")
    );

    const data: any = await response.json();
    expect(() => new Date(data.timestamp)).not.toThrow();

    const timestamp = new Date(data.timestamp);
    expect(timestamp.toISOString()).toBe(data.timestamp);
  });
});
