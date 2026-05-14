/**
 * Frontend Component Tests: FormTemplateTable publish toggle
 *
 * Regression for the browser-relative `/api/...` bug. The publish toggle used
 * `fetch("/api/form-templates/${id}/publish", { method: "PATCH" })`, which
 * landed on the React Router dev server. We mock Eden Treaty so any future
 * revert to a raw fetch will fail these tests.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router";
import { FormTemplateTable } from "../FormTemplateTable";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { FormTemplateStatus } from "@supplex/types";
import type { FormTemplateListItem } from "@supplex/types";

vi.mock("~/lib/api-client", () => ({
  createClientEdenTreatyClient: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock("~/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockPublishPatch = vi.fn();
const mockFormTemplatesCallable = vi.fn();

function buildClient() {
  mockFormTemplatesCallable.mockImplementation(() => ({
    publish: { patch: mockPublishPatch },
  }));
  return {
    api: {
      "form-templates": mockFormTemplatesCallable,
    },
  } as unknown as ReturnType<typeof createClientEdenTreatyClient>;
}

// `window.location.reload()` is called on success. jsdom's default
// `location.reload` throws "Not implemented: navigation" in tests, so stub it
// with a spy we can also assert on.
const originalLocation = window.location;
const reloadSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClientEdenTreatyClient).mockImplementation(() =>
    buildClient()
  );
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload: reloadSpy },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

function makeTemplate(
  overrides: Partial<FormTemplateListItem> = {}
): FormTemplateListItem {
  return {
    id: "tpl-1",
    name: "T1",
    status: FormTemplateStatus.DRAFT,
    templateCount: 1,
    latestTemplate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderTable(template: FormTemplateListItem) {
  return render(
    <MemoryRouter>
      <FormTemplateTable
        templates={[template]}
        onDelete={vi.fn()}
        token="tok-abc"
      />
    </MemoryRouter>
  );
}

describe("FormTemplateTable publish toggle", () => {
  test("publishes a draft template through Eden Treaty with an empty body", async () => {
    mockPublishPatch.mockResolvedValue({
      data: { success: true, data: { id: "tpl-1" } },
      error: null,
    });

    renderTable(
      makeTemplate({ id: "tpl-1", status: FormTemplateStatus.DRAFT })
    );

    fireEvent.click(screen.getByTitle("Publish template"));

    await waitFor(() => {
      expect(mockPublishPatch).toHaveBeenCalledTimes(1);
    });

    expect(createClientEdenTreatyClient).toHaveBeenCalledWith("tok-abc");
    expect(mockFormTemplatesCallable).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tpl-1" })
    );
    expect(mockPublishPatch).toHaveBeenCalledWith({});
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Template Published" })
    );
  });

  test("unpublishes a published template through Eden Treaty with action='unpublish'", async () => {
    mockPublishPatch.mockResolvedValue({
      data: { success: true, data: { id: "tpl-2" } },
      error: null,
    });

    renderTable(
      makeTemplate({ id: "tpl-2", status: FormTemplateStatus.PUBLISHED })
    );

    fireEvent.click(screen.getByTitle("Unpublish template"));

    await waitFor(() => {
      expect(mockPublishPatch).toHaveBeenCalledTimes(1);
    });

    expect(mockFormTemplatesCallable).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tpl-2" })
    );
    expect(mockPublishPatch).toHaveBeenCalledWith({ action: "unpublish" });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Template Unpublished" })
    );
  });

  test("shows a destructive toast and does not reload when Treaty returns an error", async () => {
    mockPublishPatch.mockResolvedValue({
      data: null,
      error: {
        value: {
          success: false,
          error: { code: "INTERNAL", message: "publish failed" },
        },
      },
    });

    renderTable(
      makeTemplate({ id: "tpl-3", status: FormTemplateStatus.DRAFT })
    );

    fireEvent.click(screen.getByTitle("Publish template"));

    await waitFor(() => {
      expect(mockPublishPatch).toHaveBeenCalledTimes(1);
    });

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Error",
      })
    );
  });
});
