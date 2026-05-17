/**
 * SUP-32 PR C: CompareTab component tests.
 *
 * The compare tab picks an initial (from, to) pair from the pre-loaded
 * versions list, then fetches `GET /api/form-templates/:id/version-diff`
 * client-side. These tests assert that the fetch carries the expected
 * query params, that the rendered diff is derived from the API
 * response (no hard-coded production rows), and that the empty/error
 * states fall back gracefully.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { CompareTab } from "../CompareTab";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import type { FormTemplateVersionsListData } from "@supplex/types";

vi.mock("~/lib/api-client", () => ({
  createClientEdenTreatyClient: vi.fn(),
}));

const mockDiffGet = vi.fn();
const mockFormTemplatesCallable = vi.fn();

function buildClient() {
  mockFormTemplatesCallable.mockImplementation(() => ({
    "version-diff": { get: mockDiffGet },
  }));
  return {
    api: { "form-templates": mockFormTemplatesCallable },
  } as unknown as ReturnType<typeof createClientEdenTreatyClient>;
}

const VERSIONS_FIXTURE: FormTemplateVersionsListData = {
  versions: [
    {
      id: "v-draft",
      status: "draft",
      versionNumber: null,
      basedOnVersionId: "v-2",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    },
    {
      id: "v-2",
      status: "published",
      versionNumber: 2,
      basedOnVersionId: "v-1",
      createdAt: "2026-05-05T00:00:00.000Z",
      updatedAt: "2026-05-05T00:00:00.000Z",
    },
    {
      id: "v-1",
      status: "superseded",
      versionNumber: 1,
      basedOnVersionId: null,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
  ],
};

const DIFF_OK_FIXTURE = {
  data: {
    success: true,
    data: {
      fromVersion: { id: "v-2", status: "published", versionNumber: 2 },
      toVersion: { id: "v-draft", status: "draft", versionNumber: null },
      structureChanged: true,
      structureDiffSummary: {
        addedSectionCount: 1,
        removedSectionCount: 0,
        modifiedSectionCount: 1,
        addedFieldCount: 2,
        removedFieldCount: 0,
        modifiedFieldCount: 1,
      },
      diff: {
        addedSections: [
          {
            sectionOrder: 2,
            sectionKey: "billing",
            title: "Billing details",
            fields: [
              {
                fieldOrder: 1,
                fieldKey: "account_number",
                label: "Account number",
                placeholder: null,
                fieldType: "text",
                required: true,
                validationRules: {},
                options: null,
              },
            ],
          },
        ],
        removedSections: [],
        modifiedSections: [
          {
            sectionKey: "contact",
            titleBefore: "Contact",
            titleAfter: "Contact info",
            addedFields: [
              {
                fieldOrder: 3,
                fieldKey: "phone",
                label: "Phone",
                placeholder: null,
                fieldType: "text",
                required: false,
                validationRules: {},
                options: null,
              },
            ],
            removedFields: [],
            modifiedFields: [
              {
                fieldKey: "email",
                before: {
                  fieldOrder: 1,
                  fieldKey: "email",
                  label: "Email",
                  placeholder: null,
                  fieldType: "text",
                  required: false,
                  validationRules: {},
                  options: null,
                },
                after: {
                  fieldOrder: 1,
                  fieldKey: "email",
                  label: "Email address",
                  placeholder: null,
                  fieldType: "text",
                  required: true,
                  validationRules: {},
                  options: null,
                },
              },
            ],
          },
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
  mockDiffGet.mockResolvedValue(DIFF_OK_FIXTURE);
});

describe("CompareTab", () => {
  test("fetches the diff for the default (previous head → current head) pair on mount", async () => {
    render(
      <CompareTab
        templateId="tpl-1"
        token="tok-abc"
        versions={VERSIONS_FIXTURE}
      />
    );

    await waitFor(() => {
      expect(mockDiffGet).toHaveBeenCalledTimes(1);
    });

    expect(createClientEdenTreatyClient).toHaveBeenCalledWith("tok-abc");
    expect(mockFormTemplatesCallable).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tpl-1" })
    );
    // Sorted: [draft, v2, v1]; default pair is `from = next = v-2`, `to = top = draft`.
    expect(mockDiffGet).toHaveBeenCalledWith({
      query: { fromVersionId: "v-2", toVersionId: "v-draft" },
    });
  });

  test("renders the summary + section/field changes from the fetched diff", async () => {
    render(
      <CompareTab
        templateId="tpl-1"
        token="tok-abc"
        versions={VERSIONS_FIXTURE}
      />
    );

    expect(await screen.findByText(/Sections added:/i)).toBeInTheDocument();
    expect(screen.getByText("Billing details")).toBeInTheDocument();
    expect(screen.getByText(/1\s+field/)).toBeInTheDocument();
    expect(screen.getByText("Contact info")).toBeInTheDocument();
    // Title rename hint
    expect(screen.getByText(/was "Contact"/i)).toBeInTheDocument();
    // Modified-field surface
    expect(screen.getByText("Email address")).toBeInTheDocument();
    expect(screen.getByText(/required no → yes/i)).toBeInTheDocument();
    // Section-modified added field also appears in the modified card.
    expect(screen.getByText("Phone")).toBeInTheDocument();
  });

  test("renders a no-changes message when the API reports no structural drift", async () => {
    mockDiffGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          fromVersion: { id: "v-2", status: "published", versionNumber: 2 },
          toVersion: { id: "v-draft", status: "draft", versionNumber: null },
          structureChanged: false,
          structureDiffSummary: {
            addedSectionCount: 0,
            removedSectionCount: 0,
            modifiedSectionCount: 0,
            addedFieldCount: 0,
            removedFieldCount: 0,
            modifiedFieldCount: 0,
          },
          diff: {
            addedSections: [],
            removedSections: [],
            modifiedSections: [],
          },
        },
      },
      error: null,
    });

    render(
      <CompareTab
        templateId="tpl-1"
        token="tok-abc"
        versions={VERSIONS_FIXTURE}
      />
    );

    expect(
      await screen.findByText(/No structural changes between these versions\./i)
    ).toBeInTheDocument();
  });

  test("surfaces a load error when the diff endpoint fails", async () => {
    mockDiffGet.mockResolvedValueOnce({
      data: null,
      error: {
        value: {
          success: false,
          error: { code: "INTERNAL", message: "diff blew up" },
        },
      },
    });

    render(
      <CompareTab
        templateId="tpl-1"
        token="tok-abc"
        versions={VERSIONS_FIXTURE}
      />
    );

    expect(
      await screen.findByText(/diff blew up|Failed to load version diff/i)
    ).toBeInTheDocument();
  });

  test("does not call the diff endpoint when fewer than two versions exist", async () => {
    const [onlyVersion] = VERSIONS_FIXTURE.versions;
    if (!onlyVersion) {
      throw new Error("fixture invariant: expected at least one version");
    }

    render(
      <CompareTab
        templateId="tpl-1"
        token="tok-abc"
        versions={{ versions: [onlyVersion] }}
      />
    );

    expect(
      screen.getByText(/At least two versions are needed to compare\./i)
    ).toBeInTheDocument();
    expect(mockDiffGet).not.toHaveBeenCalled();
  });

  test("falls back gracefully when the versions list is null", () => {
    render(<CompareTab templateId="tpl-1" token="tok-abc" versions={null} />);

    expect(
      screen.getByText(/Versions are unavailable right now/i)
    ).toBeInTheDocument();
    expect(mockDiffGet).not.toHaveBeenCalled();
  });
});
