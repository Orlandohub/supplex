/**
 * Regression guard: Eden Treaty must expose `.get()` after
 * `client.api["workflow-templates"]({ templateId })` with a single-key
 * payload. A prior bug used `{ workflowId, templateId }`, which made
 * Treaty return a thenable with no `.get` and broke SSR on the template
 * edit page.
 */
import { describe, test, expect } from "bun:test";
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../index";

const client = treaty<App>("http://127.0.0.1:3001");

describe("Eden Treaty workflow-templates dynamic segment", () => {
  test("single templateId exposes root .get()", () => {
    const scoped = client.api["workflow-templates"]({
      templateId: "550e8400-e29b-41d4-a716-446655440099",
    });
    expect(typeof scoped.get).toBe("function");
    expect(typeof scoped.put).toBe("function");
    expect(typeof scoped.delete).toBe("function");
  });
});
