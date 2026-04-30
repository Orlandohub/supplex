/**
 * Frontend Component Tests: Workflow Step Builder Validation Checkbox
 * Story 2.2.15
 *
 * Tests the validation checkbox and approver role selector in WorkflowStepBuilder.
 *
 * Production calls Eden Treaty paths as functions
 * (`client.api["workflow-templates"]({...}).steps.get()`) — the older
 * fixture shaped them as nested objects keyed by template id, which made
 * production code throw `client.api["workflow-templates"](...) is not a
 * function` and the dialog never finished mounting (so
 * `getByLabelText(/Requires Validation/i)` timed out). The mock here
 * matches the templated callable shape and lets `vi.mocked(...)` swap the
 * `post` spy per test instead of using ESM-incompatible `require()`.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { WorkflowStepBuilder } from "../WorkflowStepBuilder";
import { createClientEdenTreatyClient } from "~/lib/api-client";

// Radix Select calls `Element.hasPointerCapture` on its trigger when it
// receives a pointer event. jsdom (the Vitest DOM) does not implement
// the pointer-capture API, so opening the popover via `userEvent.click`
// throws `TypeError: target.hasPointerCapture is not a function` and the
// option list never mounts. Polyfill the no-op shape jsdom expects.
if (typeof Element !== "undefined") {
  if (typeof Element.prototype.hasPointerCapture !== "function") {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (typeof Element.prototype.releasePointerCapture !== "function") {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => undefined;
  }
}

vi.mock("~/lib/api-client", () => ({
  createClientEdenTreatyClient: vi.fn(),
}));

vi.mock("~/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockStepsGet = vi.fn();
const mockStepsPost = vi.fn();
const mockFormTemplatesGet = vi.fn();
const mockDocumentTemplatesGet = vi.fn();

function buildClient() {
  return {
    api: {
      "workflow-templates": vi.fn(() => ({
        steps: {
          get: mockStepsGet,
          post: mockStepsPost,
        },
      })),
      "form-templates": {
        published: { get: mockFormTemplatesGet },
      },
      "document-templates": {
        published: { get: mockDocumentTemplatesGet },
      },
    },
    // The Eden Treaty client surface is large (auto-generated from the
    // Elysia routes); this single trust-boundary cast keeps the test
    // narrow rather than reproducing the entire client shape.
  } as unknown as ReturnType<typeof createClientEdenTreatyClient>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStepsGet.mockResolvedValue({
    data: { success: true, data: [] },
    error: null,
  });
  mockStepsPost.mockResolvedValue({
    data: { success: true },
    error: null,
  });
  mockFormTemplatesGet.mockResolvedValue({
    data: { success: true, data: { templates: [] } },
    error: null,
  });
  mockDocumentTemplatesGet.mockResolvedValue({
    data: { success: true, data: { templates: [] } },
    error: null,
  });
  vi.mocked(createClientEdenTreatyClient).mockImplementation(() =>
    buildClient()
  );
});

describe("WorkflowStepBuilder - Validation Checkbox", () => {
  const mockUsers = [
    { id: "1", email: "admin@test.com", name: "Admin User", role: "admin" },
  ];

  // The component starts with `isLoading: true` and only flips to false
  // once `fetchSteps()` resolves. The header "Add Step" button is
  // disabled while loading, so a synchronous `fireEvent.click(...)` right
  // after `render(...)` fires on a disabled button and does nothing.
  // This helper waits for the button to become enabled before clicking.
  async function openAddStepDialog() {
    const addButton = await screen.findByRole("button", {
      name: /add step/i,
    });
    await waitFor(() => expect(addButton).not.toBeDisabled());
    fireEvent.click(addButton);
    return screen.findByLabelText(/Requires Validation/i);
  }

  test("checkbox renders correctly", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const checkbox = await openAddStepDialog();
    expect(checkbox).toBeInTheDocument();
  });

  test("checkbox toggles correctly", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const checkbox = await openAddStepDialog();
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  test("approver role selector appears when checkbox is checked", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const checkbox = await openAddStepDialog();
    expect(
      screen.queryByText(/Validation Approver Roles/i)
    ).not.toBeInTheDocument();

    fireEvent.click(checkbox);

    expect(screen.getByText(/Validation Approver Roles/i)).toBeInTheDocument();
    // The form's Assignee Role select also offers an "Admin" option, so
    // a bare exact-text match would hit two nodes. Anchor each role to
    // the validation-roles section by looking up the explicit label
    // associations (`<label htmlFor="validation-role-admin">Admin</label>`).
    expect(screen.getByLabelText("Admin")).toBeInTheDocument();
    expect(screen.getByLabelText("Procurement Manager")).toBeInTheDocument();
    expect(screen.getByLabelText("Quality Manager")).toBeInTheDocument();
  });

  test("approver role selector hidden when checkbox is unchecked", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const checkbox = await openAddStepDialog();
    fireEvent.click(checkbox);
    expect(screen.getByText(/Validation Approver Roles/i)).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(
      screen.queryByText(/Validation Approver Roles/i)
    ).not.toBeInTheDocument();
  });

  test("form validation fails if checkbox checked but no roles selected", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const checkbox = await openAddStepDialog();

    const nameInput = screen.getByLabelText(/Step Name/i);
    fireEvent.change(nameInput, { target: { value: "Test Step" } });

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText(/Create Step/i));

    await waitFor(() => {
      expect(
        screen.getByText(/At least one approver role is required/i)
      ).toBeInTheDocument();
    });
  });

  test("can select and deselect approver roles", async () => {
    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const checkbox = await openAddStepDialog();
    fireEvent.click(checkbox);

    // Role checkboxes have explicit `htmlFor` associations
    // (`validation-role-admin` etc.), so prefer label-based lookup over
    // parent-textContent search — Radix wraps the button with extra
    // markup that made the previous heuristic flaky.
    const adminCheckbox = screen.getByLabelText("Admin");
    const qualityCheckbox = screen.getByLabelText("Quality Manager");

    fireEvent.click(adminCheckbox);
    expect(adminCheckbox).toBeChecked();

    fireEvent.click(qualityCheckbox);
    expect(qualityCheckbox).toBeChecked();

    fireEvent.click(adminCheckbox);
    expect(adminCheckbox).not.toBeChecked();
  });

  test("form submission includes validation config in payload", async () => {
    // The default `stepType` is "form", which requires a `formTemplateId`
    // to satisfy the Zod schema's `superRefine`. Without a published
    // template the submit silently fails and `mockStepsPost` is never
    // called. Provide one template here so the form passes validation
    // and we can assert the validation-config payload shape.
    mockFormTemplatesGet.mockResolvedValue({
      data: {
        success: true,
        data: {
          templates: [
            {
              id: "form-template-1",
              label: "Test Form Template",
              version: 1,
            },
          ],
        },
      },
      error: null,
    });

    render(
      <WorkflowStepBuilder
        templateId="test-template-id"
        canEdit={true}
        users={mockUsers}
        token="test-token"
      />
    );

    const checkbox = await openAddStepDialog();

    const nameInput = screen.getByLabelText(/Step Name/i);
    fireEvent.change(nameInput, {
      target: { value: "Test Validation Step" },
    });

    // Select the seeded form template so `formTemplateId` is populated
    // (the `<Select>` is keyed by the templates fetched on dialog open).
    // Radix Select reacts to `pointerdown`, not the synthetic `click`
    // event `fireEvent.click` ships, so use `userEvent` to open the
    // popover and pick the option.
    const user = userEvent.setup();
    const formTemplateTrigger = await screen.findByRole("combobox", {
      name: /Form Template/i,
    });
    await waitFor(() =>
      expect(formTemplateTrigger).not.toHaveAttribute("disabled")
    );
    await user.click(formTemplateTrigger);
    await user.click(
      await screen.findByRole("option", { name: "Test Form Template" })
    );

    fireEvent.click(checkbox);

    // See "can select and deselect approver roles" — use the label
    // association rather than walking the DOM by `parentElement`.
    const qualityCheckbox = screen.getByLabelText("Quality Manager");
    fireEvent.click(qualityCheckbox);

    fireEvent.click(screen.getByText(/Create Step/i));

    await waitFor(() => {
      expect(mockStepsPost).toHaveBeenCalledWith(
        expect.objectContaining({
          requiresValidation: true,
          validationConfig: expect.objectContaining({
            approverRoles: expect.arrayContaining(["quality_manager"]),
          }),
        })
      );
    });
  });
});
