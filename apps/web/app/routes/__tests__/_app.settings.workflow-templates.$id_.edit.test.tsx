/**
 * Ensures workflow template edit loader scopes Treaty with a single
 * `templateId` key — dual-key `{ workflowId, templateId }` breaks Eden `.get()`
 * at runtime.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../_app.settings.workflow-templates.$id_.edit";
import { createLoaderArgs } from "~/lib/test-utils";
import { UserRole } from "@supplex/types";
import { createEdenTreatyClient } from "~/lib/api-client";

const mockScopedWorkflowTemplates = vi.fn();
const mockWorkflowTemplateGet = vi.fn();

const mockUsersListGet = vi.fn();
const mockWorkflowTypesGet = vi.fn();

vi.mock("~/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(() =>
    Promise.resolve({
      user: { id: "user-1" },
      session: { access_token: "tok" },
      userRecord: {
        role: UserRole.ADMIN,
      },
    })
  ),
}));

vi.mock("~/lib/api-client", () => ({
  createEdenTreatyClient: vi.fn(() => ({
    api: {
      "workflow-templates": mockScopedWorkflowTemplates,
      users: { get: mockUsersListGet },
      admin: { "workflow-types": { get: mockWorkflowTypesGet } },
    },
  })),
}));

describe("workflow template edit loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScopedWorkflowTemplates.mockImplementation(() => ({
      get: mockWorkflowTemplateGet,
    }));
    mockWorkflowTemplateGet.mockResolvedValue({
      error: null,
      data: {
        success: true,
        data: {
          id: "template-uuid-1",
          name: "Qualification",
          description: null,
          processType: "supplier_workflow",
          status: "draft",
          active: true,
          steps: [],
        },
      },
      status: 200,
    });

    mockUsersListGet.mockResolvedValue({
      error: null,
      data: {
        success: true,
        data: {
          users: [
            {
              id: "u1",
              email: "a@example.com",
              fullName: "Ada",
              role: "admin",
            },
          ],
        },
      },
      status: 200,
    });

    mockWorkflowTypesGet.mockResolvedValue({
      error: null,
      data: {
        success: true,
        data: [{ id: "wt1", name: "Type", supplierStatusId: null }],
      },
      status: 200,
    });
    vi.mocked(createEdenTreatyClient).mockImplementation(
      () =>
        ({
          api: {
            "workflow-templates": mockScopedWorkflowTemplates,
            users: { get: mockUsersListGet },
            admin: { "workflow-types": { get: mockWorkflowTypesGet } },
          },
        }) as unknown as ReturnType<typeof createEdenTreatyClient>
    );
  });

  it("calls Treaty with exactly { templateId } before .get()", async () => {
    const req = new Request(
      "http://localhost/settings/workflow-templates/template-uuid-1/edit"
    );
    const args = createLoaderArgs(req, { id: "template-uuid-1" });
    await loader(args);

    expect(mockScopedWorkflowTemplates).toHaveBeenCalledTimes(1);
    expect(mockScopedWorkflowTemplates).toHaveBeenCalledWith({
      templateId: "template-uuid-1",
    });
    const callArg = mockScopedWorkflowTemplates.mock.calls[0]?.[0] as Record<
      string,
      string
    >;
    expect(Object.keys(callArg)).toEqual(["templateId"]);
    expect(mockWorkflowTemplateGet).toHaveBeenCalledTimes(1);
  });
});
