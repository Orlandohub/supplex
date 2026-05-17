/**
 * SUP-32 PR B: PublishConfirmationDialog component test.
 *
 * Verifies that the dialog:
 *   - loads the publish-preview through Eden Treaty,
 *   - renders the structure-diff summary + impact buckets from the
 *     mocked response (no hard-coded copy from production data), and
 *   - calls PATCH publish with the correct body for both initial publish
 *     (empty body) and republish (action: "publish").
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { PublishConfirmationDialog } from "../PublishConfirmationDialog";
import { createClientEdenTreatyClient } from "~/lib/api-client";

vi.mock("~/lib/api-client", () => ({
  createClientEdenTreatyClient: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock("~/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockPreviewGet = vi.fn();
const mockPublishPatch = vi.fn();
const mockFormTemplatesCallable = vi.fn();

function buildClient() {
  mockFormTemplatesCallable.mockImplementation(() => ({
    "publish-preview": { get: mockPreviewGet },
    publish: { patch: mockPublishPatch },
  }));
  return {
    api: { "form-templates": mockFormTemplatesCallable },
  } as unknown as ReturnType<typeof createClientEdenTreatyClient>;
}

const PREVIEW_OK_FIXTURE = {
  data: {
    success: true,
    data: {
      structureChanged: true,
      structureDiffSummary: {
        addedSectionCount: 1,
        removedSectionCount: 0,
        modifiedSectionCount: 0,
        addedFieldCount: 3,
        removedFieldCount: 0,
        modifiedFieldCount: 0,
      },
      diff: {
        addedSections: [],
        removedSections: [],
        modifiedSections: [],
      },
      publishImpact: {
        workflowTemplatesReferencingContainer: [
          { id: "wf-1", name: "Vendor onboarding" },
        ],
        activeProcessesWithSupersededPin: [
          { id: "p-1", workflowName: "Active vendor flow", status: "running" },
        ],
      },
    },
  },
  error: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClientEdenTreatyClient).mockImplementation(() =>
    buildClient()
  );
  mockPreviewGet.mockResolvedValue(PREVIEW_OK_FIXTURE);
  mockPublishPatch.mockResolvedValue({
    data: { success: true },
    error: null,
  });
});

function renderDialog(
  props?: Partial<React.ComponentProps<typeof PublishConfirmationDialog>>
) {
  const defaults: React.ComponentProps<typeof PublishConfirmationDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    templateId: "tpl-1",
    templateStatus: "draft",
    token: "tok-abc",
    onPublished: vi.fn(),
  };
  return render(<PublishConfirmationDialog {...defaults} {...props} />);
}

describe("PublishConfirmationDialog", () => {
  test("loads publish-preview through Eden Treaty and renders impact + summary", async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockPreviewGet).toHaveBeenCalledTimes(1);
    });

    expect(createClientEdenTreatyClient).toHaveBeenCalledWith("tok-abc");
    expect(mockFormTemplatesCallable).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tpl-1" })
    );

    // Summary derived from the mocked publish-preview fixture
    expect(await screen.findByText(/Sections added:/i)).toBeInTheDocument();
    expect(screen.getByText("Vendor onboarding")).toBeInTheDocument();
    expect(screen.getByText("Active vendor flow")).toBeInTheDocument();
    expect(
      screen.getByText(/In-flight processes that have already started/i)
    ).toBeInTheDocument();
  });

  test("initial publish (draft) sends an empty body to PATCH publish and revalidates", async () => {
    const onPublished = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({
      templateStatus: "draft",
      onPublished,
      onOpenChange,
    });

    await waitFor(() => {
      expect(mockPreviewGet).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));

    await waitFor(() => {
      expect(mockPublishPatch).toHaveBeenCalledTimes(1);
    });

    expect(mockPublishPatch).toHaveBeenCalledWith({});
    expect(onPublished).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Template published" })
    );
  });

  test("republish (published) sends { action: 'publish' } to PATCH publish", async () => {
    renderDialog({ templateStatus: "published" });

    await waitFor(() => {
      expect(mockPreviewGet).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));

    await waitFor(() => {
      expect(mockPublishPatch).toHaveBeenCalledTimes(1);
    });

    expect(mockPublishPatch).toHaveBeenCalledWith({ action: "publish" });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Version published" })
    );
  });

  test("surfaces server-side publish error and does not close", async () => {
    mockPublishPatch.mockResolvedValueOnce({
      data: null,
      error: {
        value: {
          success: false,
          error: {
            code: "FORM_TEMPLATE_PUBLISH_NO_FIELDS",
            message: "Cannot publish without fields",
          },
        },
      },
    });

    const onPublished = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onPublished, onOpenChange });

    await waitFor(() => {
      expect(mockPreviewGet).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Cannot publish without fields",
        })
      );
    });

    expect(onPublished).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("shows an inline error and disables Publish when preview fails to load", async () => {
    mockPreviewGet.mockResolvedValueOnce({
      data: null,
      error: {
        value: {
          success: false,
          error: { code: "INTERNAL", message: "boom" },
        },
      },
    });

    renderDialog();

    expect(
      await screen.findByText(/boom|Failed to load publish preview/i)
    ).toBeInTheDocument();
    const publishBtn = screen.getByRole("button", { name: /^publish$/i });
    expect(publishBtn).toBeDisabled();
  });
});
