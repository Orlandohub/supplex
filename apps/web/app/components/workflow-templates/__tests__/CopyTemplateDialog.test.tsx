/**
 * Frontend Component Tests: CopyWorkflowTemplateDialog
 *
 * Regression for the browser-relative `/api/...` bug. Same Treaty-mocking
 * approach as the form-template copy test: any revert to a raw
 * `fetch("/api/...")` call will fail this test because the Treaty spy never
 * sees the request.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import type * as ReactRouter from "react-router";
import { CopyWorkflowTemplateDialog } from "../CopyTemplateDialog";
import { createClientEdenTreatyClient } from "~/lib/api-client";

vi.mock("~/lib/api-client", () => ({
  createClientEdenTreatyClient: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock("~/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof ReactRouter>("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockCopyPost = vi.fn();
const mockWorkflowTemplatesCallable = vi.fn();

function buildClient() {
  mockWorkflowTemplatesCallable.mockImplementation(() => ({
    copy: { post: mockCopyPost },
  }));
  return {
    api: {
      "workflow-templates": mockWorkflowTemplatesCallable,
    },
  } as unknown as ReturnType<typeof createClientEdenTreatyClient>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClientEdenTreatyClient).mockImplementation(() =>
    buildClient()
  );
});

function renderDialog(
  props?: Partial<React.ComponentProps<typeof CopyWorkflowTemplateDialog>>
) {
  const defaults: React.ComponentProps<typeof CopyWorkflowTemplateDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    templateId: "wf-tpl-1",
    templateName: "Original Workflow",
    templateDescription: "An original",
    token: "tok-abc",
  };
  return render(<CopyWorkflowTemplateDialog {...defaults} {...props} />);
}

describe("CopyWorkflowTemplateDialog", () => {
  test("dispatches the copy through Eden Treaty and navigates to the new workflow template's edit page on success", async () => {
    mockCopyPost.mockResolvedValue({
      data: { success: true, data: { id: "wf-new-9" } },
      error: null,
    });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.click(screen.getByRole("button", { name: /copy template/i }));

    await waitFor(() => {
      expect(mockCopyPost).toHaveBeenCalledTimes(1);
    });

    expect(createClientEdenTreatyClient).toHaveBeenCalledWith("tok-abc");
    expect(mockWorkflowTemplatesCallable).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "wf-tpl-1" })
    );
    expect(mockCopyPost).toHaveBeenCalledWith({
      name: "Copy of Original Workflow",
      description: "An original",
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/settings/workflow-templates/wf-new-9/edit"
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Template Copied" })
    );
  });

  test("omits description from the request body when the field is left blank", async () => {
    mockCopyPost.mockResolvedValue({
      data: { success: true, data: { id: "wf-new-10" } },
      error: null,
    });
    renderDialog({ templateDescription: null });

    fireEvent.click(screen.getByRole("button", { name: /copy template/i }));

    await waitFor(() => {
      expect(mockCopyPost).toHaveBeenCalledTimes(1);
    });
    expect(mockCopyPost).toHaveBeenCalledWith({
      name: "Copy of Original Workflow",
    });
  });

  test("shows a destructive toast and does not navigate when Treaty returns an error envelope", async () => {
    mockCopyPost.mockResolvedValue({
      data: null,
      error: {
        value: {
          success: false,
          error: { code: "INTERNAL", message: "kaboom" },
        },
      },
    });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.click(screen.getByRole("button", { name: /copy template/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "kaboom",
        })
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
