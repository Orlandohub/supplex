/**
 * Frontend Component Tests: CopyFormTemplateDialog
 *
 * Regression for the browser-relative `/api/...` bug that landed copy POSTs on
 * the React Router dev server's catch-all (405). We mock Eden Treaty so this
 * test also fails the day anyone reverts to a raw `fetch("/api/...")` call —
 * the spy never sees the request.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import type * as ReactRouter from "react-router";
import { CopyFormTemplateDialog } from "../CopyTemplateDialog";
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
const mockFormTemplatesCallable = vi.fn();

function buildClient() {
  mockFormTemplatesCallable.mockImplementation(() => ({
    copy: { post: mockCopyPost },
  }));
  return {
    api: {
      "form-templates": mockFormTemplatesCallable,
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
  props?: Partial<React.ComponentProps<typeof CopyFormTemplateDialog>>
) {
  const defaults: React.ComponentProps<typeof CopyFormTemplateDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    templateId: "tpl-123",
    templateName: "Original Template",
    token: "tok-abc",
  };
  return render(<CopyFormTemplateDialog {...defaults} {...props} />);
}

describe("CopyFormTemplateDialog", () => {
  test("dispatches the copy through Eden Treaty (not a relative fetch) and navigates to the new template's edit page on success", async () => {
    mockCopyPost.mockResolvedValue({
      data: { success: true, data: { id: "new-tpl-456" } },
      error: null,
    });
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.click(screen.getByRole("button", { name: /copy template/i }));

    await waitFor(() => {
      expect(mockCopyPost).toHaveBeenCalledTimes(1);
    });

    // Eden Treaty was constructed with the user's token and the index callable
    // was passed the template id under the `:id` branch.
    expect(createClientEdenTreatyClient).toHaveBeenCalledWith("tok-abc");
    expect(mockFormTemplatesCallable).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "tpl-123" })
    );
    expect(mockCopyPost).toHaveBeenCalledWith({
      name: "Copy of Original Template",
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/settings/form-templates/new-tpl-456/edit"
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Template Copied" })
    );
  });

  test("shows a destructive toast and does not navigate when Treaty returns an error envelope", async () => {
    mockCopyPost.mockResolvedValue({
      data: null,
      error: {
        value: {
          success: false,
          error: { code: "INTERNAL", message: "boom" },
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
          description: "boom",
        })
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("blocks submission and toasts when name is empty (does not hit the API)", async () => {
    renderDialog({ templateName: "" });
    const input = screen.getByLabelText(/template name/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });

    fireEvent.click(screen.getByRole("button", { name: /copy template/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Template name is required",
        })
      );
    });
    expect(mockCopyPost).not.toHaveBeenCalled();
  });
});
