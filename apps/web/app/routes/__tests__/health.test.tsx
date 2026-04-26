import { describe, it, expect } from "vitest";
import { loader } from "../health";

describe("Frontend Health Check", () => {
  it("should return 200 OK with health status", async () => {
    const response = await loader();

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: "ok",
      service: "web",
      version: "1.0.0",
    });
    expect(data.timestamp).toBeDefined();
    expect(typeof data.timestamp).toBe("string");
  });

  it("should include no-cache headers", async () => {
    const response = await loader();

    const cacheControl = response.headers.get("Cache-Control");
    expect(cacheControl).toContain("no-cache");
    expect(cacheControl).toContain("no-store");
  });

  it("should include environment information", async () => {
    const response = await loader();

    const data = await response.json();
    expect(data.environment).toBeDefined();
  });
});
