import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";
import { correlationId } from "../correlation-id";

function createTestApp() {
  return new Elysia()
    .use(correlationId)
    .get("/test", ({ correlationId: corrId }) => ({ correlationId: corrId }));
}

describe("Correlation ID Middleware", () => {
  test("generates a UUID correlation ID when no header is provided", async () => {
    const app = createTestApp();
    const res = await app.handle(new Request("http://localhost/test"));
    const body = (await res.json()) as { correlationId: string };
    const header = res.headers.get("x-correlation-id");

    expect(header).toBeTruthy();
    expect(body.correlationId).toBeTruthy();
    expect(body.correlationId).toBe(header);
    expect(body.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  test("uses the provided X-Correlation-ID header if present", async () => {
    const app = createTestApp();
    const customId = "my-custom-trace-id-123";
    const res = await app.handle(
      new Request("http://localhost/test", {
        headers: { "x-correlation-id": customId },
      })
    );
    const body = (await res.json()) as { correlationId: string };
    const header = res.headers.get("x-correlation-id");

    expect(body.correlationId).toBe(customId);
    expect(header).toBe(customId);
  });

  test("sets X-Correlation-ID response header", async () => {
    const app = createTestApp();
    const res = await app.handle(new Request("http://localhost/test"));
    const header = res.headers.get("x-correlation-id");

    expect(header).toBeTruthy();
  });

  test("provides requestLogger in the context", async () => {
    const app = new Elysia()
      .use(correlationId)
      .get("/test-logger", ({ requestLogger }) => ({
        hasLogger: !!requestLogger,
        hasInfo: typeof requestLogger?.info === "function",
        hasError: typeof requestLogger?.error === "function",
      }));

    const res = await app.handle(new Request("http://localhost/test-logger"));
    const body = (await res.json()) as { hasLogger: boolean; hasInfo: boolean; hasError: boolean };

    expect(body.hasLogger).toBe(true);
    expect(body.hasInfo).toBe(true);
    expect(body.hasError).toBe(true);
  });
});
