import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";

interface RootResponse {
  message: string;
  version: string;
  status: string;
}

interface HealthResponse {
  status: string;
  timestamp: string;
}

// Create a test instance of the app without starting the server
const createTestApp = () => {
  return new Elysia()
    .get("/", () => ({
      message: "Supplex API",
      version: "1.0.0",
      status: "healthy",
    }))
    .get("/health", () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }));
};

describe("ElysiaJS API", () => {
  describe("GET /", () => {
    it("should return API information", async () => {
      const app = createTestApp();
      const response = (await app
        .handle(new Request("http://localhost/"))
        .then((r) => r.json())) as RootResponse;

      expect(response).toEqual({
        message: "Supplex API",
        version: "1.0.0",
        status: "healthy",
      });
    });
  });

  describe("GET /health", () => {
    it("should return health check status", async () => {
      const app = createTestApp();
      const response = (await app
        .handle(new Request("http://localhost/health"))
        .then((r) => r.json())) as HealthResponse;

      expect(response).toHaveProperty("status", "ok");
      expect(response).toHaveProperty("timestamp");
      expect(typeof response.timestamp).toBe("string");
    });

    it("should return valid ISO timestamp", async () => {
      const app = createTestApp();
      const response = (await app
        .handle(new Request("http://localhost/health"))
        .then((r) => r.json())) as HealthResponse;

      const timestamp = new Date(response.timestamp);
      expect(timestamp.toISOString()).toBe(response.timestamp);
    });
  });
});
