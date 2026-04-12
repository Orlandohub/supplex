import { describe, test, expect } from "bun:test";
import logger, { createChildLogger } from "../logger";

describe("Logger Module", () => {
  test("exports a pino logger instance", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  test("creates child loggers with context", () => {
    const child = logger.child({ module: "test" });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
  });

  test("createChildLogger helper works", () => {
    const child = createChildLogger({ correlationId: "test-123", tenantId: "t1" });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
  });

  test("logger has correct base fields", () => {
    expect(logger.bindings()).toHaveProperty("service", "supplex-api");
  });
});
