/**
 * SUP-32 PR B: form-template edit loader test.
 *
 * Verifies the loader fetches only what the active tab needs:
 *   - `?tab=builder` (default) only calls GET /:id
 *   - `?tab=versions` adds GET /:id/versions
 *   - `?tab=changelog` adds GET /:id/audit-events
 *   - `?tab=usage` adds GET /:id/usage
 *
 * Also asserts that Treaty is called with the single-key `{ id }` bag
 * (the documented trap from `api-helpers.ts`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../_app.settings.form-templates.$id_.edit";
import { createLoaderArgs } from "~/lib/test-utils";
import { UserRole } from "@supplex/types";
import { createEdenTreatyClient } from "~/lib/api-client";

// `data()` from react-router wraps return values in a
// `{ type: "DataWithResponseInit"; data: T; init }` envelope. Unwrap
// here so tests can assert on the loader payload directly.
type LoaderEnvelope<T> = {
  type: "DataWithResponseInit";
  data: T;
  init: unknown;
};
function unwrap<T>(result: unknown): T {
  return (result as LoaderEnvelope<T>).data;
}

const mockScopedFormTemplates = vi.fn();
const mockTemplateGet = vi.fn();
const mockVersionsGet = vi.fn();
const mockAuditEventsGet = vi.fn();
const mockUsageGet = vi.fn();

vi.mock("~/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: "user-1" },
      session: { access_token: "tok" },
      userRecord: { role: UserRole.ADMIN },
    })
  ),
}));

vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(() => ({
    api: { "form-templates": mockScopedFormTemplates },
  })),
}));

describe("form-template edit loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockScopedFormTemplates.mockImplementation(() => ({
      get: mockTemplateGet,
      versions: { get: mockVersionsGet },
      "audit-events": { get: mockAuditEventsGet },
      usage: { get: mockUsageGet },
    }));

    mockTemplateGet.mockResolvedValue({
      error: null,
      data: {
        success: true,
        data: {
          id: "tpl-1",
          name: "Vendor onboarding",
          status: "draft",
          sections: [],
        },
      },
      status: 200,
    });

    mockVersionsGet.mockResolvedValue({
      error: null,
      data: {
        success: true,
        data: { versions: [] },
      },
      status: 200,
    });

    mockAuditEventsGet.mockResolvedValue({
      error: null,
      data: {
        success: true,
        data: { events: [], nextCursor: null },
      },
      status: 200,
    });

    mockUsageGet.mockResolvedValue({
      error: null,
      data: {
        success: true,
        data: {
          publishedHeadVersionId: null,
          publishedHeadVersionNumber: null,
          impact: {
            workflowTemplatesReferencingContainer: [],
            activeProcessesWithSupersededPin: [],
          },
        },
      },
      status: 200,
    });

    vi.mocked(createEdenTreatyClient).mockImplementation(
      () =>
        ({
          api: { "form-templates": mockScopedFormTemplates },
        }) as unknown as ReturnType<typeof createEdenTreatyClient>
    );
  });

  it("calls Treaty with exactly { id } and defaults to the builder tab", async () => {
    const req = new Request(
      "http://localhost/settings/form-templates/tpl-1/edit"
    );
    const args = createLoaderArgs(req, { id: "tpl-1" });
    const result = await loader(args);

    expect(mockScopedFormTemplates).toHaveBeenCalledWith({ id: "tpl-1" });
    const callArg = mockScopedFormTemplates.mock.calls[0]?.[0] as Record<
      string,
      string
    >;
    expect(Object.keys(callArg)).toEqual(["id"]);
    expect(mockTemplateGet).toHaveBeenCalledTimes(1);

    expect(mockVersionsGet).not.toHaveBeenCalled();
    expect(mockAuditEventsGet).not.toHaveBeenCalled();
    expect(mockUsageGet).not.toHaveBeenCalled();

    expect(
      unwrap<{ initialTabData: Record<string, unknown> }>(result)
    ).toMatchObject({
      initialTabData: {
        versions: null,
        auditEvents: null,
        usage: null,
      },
    });
  });

  it("fetches versions when ?tab=versions", async () => {
    const req = new Request(
      "http://localhost/settings/form-templates/tpl-1/edit?tab=versions"
    );
    const args = createLoaderArgs(req, { id: "tpl-1" });
    const result = await loader(args);

    expect(mockVersionsGet).toHaveBeenCalledTimes(1);
    expect(mockAuditEventsGet).not.toHaveBeenCalled();
    expect(mockUsageGet).not.toHaveBeenCalled();
    expect(
      unwrap<{
        initialTabData: { versions: { versions: unknown[] } };
      }>(result)
    ).toMatchObject({
      initialTabData: { versions: { versions: [] } },
    });
  });

  it("fetches audit events when ?tab=changelog", async () => {
    const req = new Request(
      "http://localhost/settings/form-templates/tpl-1/edit?tab=changelog"
    );
    const args = createLoaderArgs(req, { id: "tpl-1" });
    const result = await loader(args);

    expect(mockAuditEventsGet).toHaveBeenCalledTimes(1);
    expect(mockAuditEventsGet).toHaveBeenCalledWith({
      query: { limit: 50 },
    });
    expect(mockVersionsGet).not.toHaveBeenCalled();
    expect(mockUsageGet).not.toHaveBeenCalled();
    expect(
      unwrap<{
        initialTabData: {
          auditEvents: { events: unknown[]; nextCursor: string | null };
        };
      }>(result)
    ).toMatchObject({
      initialTabData: {
        auditEvents: { events: [], nextCursor: null },
      },
    });
  });

  it("fetches usage when ?tab=usage", async () => {
    const req = new Request(
      "http://localhost/settings/form-templates/tpl-1/edit?tab=usage"
    );
    const args = createLoaderArgs(req, { id: "tpl-1" });
    const result = await loader(args);

    expect(mockUsageGet).toHaveBeenCalledTimes(1);
    expect(mockVersionsGet).not.toHaveBeenCalled();
    expect(mockAuditEventsGet).not.toHaveBeenCalled();
    expect(
      unwrap<{
        initialTabData: {
          usage: {
            publishedHeadVersionId: string | null;
            publishedHeadVersionNumber: number | null;
          };
        };
      }>(result)
    ).toMatchObject({
      initialTabData: {
        usage: {
          publishedHeadVersionId: null,
          publishedHeadVersionNumber: null,
        },
      },
    });
  });

  it("falls back to builder for unknown tab values", async () => {
    const req = new Request(
      "http://localhost/settings/form-templates/tpl-1/edit?tab=mystery"
    );
    const args = createLoaderArgs(req, { id: "tpl-1" });
    const result = await loader(args);

    expect(
      unwrap<{ initialTabData: { versions: null } }>(result)
    ).toMatchObject({
      initialTabData: {
        versions: null,
        auditEvents: null,
        usage: null,
      },
    });
    expect(mockVersionsGet).not.toHaveBeenCalled();
    expect(mockAuditEventsGet).not.toHaveBeenCalled();
    expect(mockUsageGet).not.toHaveBeenCalled();
  });
});
