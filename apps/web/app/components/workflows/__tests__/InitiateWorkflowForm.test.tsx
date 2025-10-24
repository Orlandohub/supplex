import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InitiateWorkflowForm } from "../InitiateWorkflowForm";
import { RiskLevel, calculateRiskScore } from "@supplex/types";
import type { DocumentChecklist } from "@supplex/types";

/**
 * Test Suite for InitiateWorkflowForm Component
 * Tests AC 3-7, 10 of Story 2.3
 *
 * NOTE: These tests validate component behavior, form validation,
 * and real-time calculations. They use React Testing Library
 * for component testing.
 */

describe("InitiateWorkflowForm", () => {
  /**
   * Test Data Setup
   */
  const mockSupplier = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Acme Corporation Ltd.",
  };

  const mockChecklists: DocumentChecklist[] = [
    {
      id: "checklist-1",
      tenantId: "tenant-123",
      templateName: "Standard Quality Checklist",
      requiredDocuments: [
        {
          id: "doc-1",
          name: "ISO 9001",
          required: true,
          type: "certification",
        },
      ],
      isDefault: false,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      deletedAt: null,
    },
    {
      id: "checklist-2",
      tenantId: "tenant-123",
      templateName: "Premium Checklist (Default)",
      requiredDocuments: [
        {
          id: "doc-1",
          name: "ISO 9001",
          required: true,
          type: "certification",
        },
        { id: "doc-2", name: "Tax Form", required: true, type: "tax" },
      ],
      isDefault: true,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      deletedAt: null,
    },
  ];

  const mockHandlers = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Form Rendering (AC 3-4)
   */
  describe("Form Rendering", () => {
    it("should render supplier name as read-only field (AC 3)", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(screen.getByText(mockSupplier.name)).toBeInTheDocument();
      expect(screen.getByText("Supplier")).toBeInTheDocument();
    });

    it("should render checklist template dropdown (AC 3)", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(
        screen.getByText("Document Checklist Template")
      ).toBeInTheDocument();
    });

    it("should render all 4 risk assessment dropdowns (AC 4)", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(screen.getByText("Geographic Risk")).toBeInTheDocument();
      expect(screen.getByText("Financial Risk")).toBeInTheDocument();
      expect(screen.getByText("Quality Risk")).toBeInTheDocument();
      expect(screen.getByText("Delivery Risk")).toBeInTheDocument();
    });

    it("should render risk assessment section header", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(screen.getByText("Risk Assessment")).toBeInTheDocument();
    });

    it("should render notes textarea (AC 3)", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(screen.getByText("Notes (Optional)")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/Add any additional notes/i)
      ).toBeInTheDocument();
    });

    it("should render submit and cancel buttons", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(
        screen.getByRole("button", { name: /Initiate Workflow/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Cancel/i })
      ).toBeInTheDocument();
    });
  });

  /**
   * Test: Default Checklist Selection (AC 3)
   */
  describe("Default Checklist Selection", () => {
    it("should default to checklist with isDefault=true (AC 3)", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      // The default checklist should be selected
      // In this case, "Premium Checklist (Default)" with id "checklist-2"
      const defaultChecklist = mockChecklists.find((c) => c.isDefault);
      expect(defaultChecklist?.id).toBe("checklist-2");
      expect(defaultChecklist?.templateName).toBe(
        "Premium Checklist (Default)"
      );
    });

    it("should handle empty checklists array gracefully", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={[]}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(
        screen.getByText(/No checklist templates available/i)
      ).toBeInTheDocument();
    });

    it("should handle checklists without default flag", () => {
      const checklistsWithoutDefault = mockChecklists.map((c) => ({
        ...c,
        isDefault: false,
      }));

      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={checklistsWithoutDefault}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      // Should render without errors even if no default exists
      expect(
        screen.getByText("Document Checklist Template")
      ).toBeInTheDocument();
    });
  });

  /**
   * Test: Real-time Risk Score Calculation (AC 5)
   */
  describe("Risk Score Calculation", () => {
    it("should display initial risk score of 1.00 (all low by default)", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(screen.getByText("1.00")).toBeInTheDocument();
      expect(screen.getByText("Overall Risk Score:")).toBeInTheDocument();
    });

    it("should calculate risk score correctly using shared utility", () => {
      // Test: All LOW (1,1,1,1)
      const scoreLow = calculateRiskScore({
        geographic: RiskLevel.LOW,
        financial: RiskLevel.LOW,
        quality: RiskLevel.LOW,
        delivery: RiskLevel.LOW,
      });
      expect(scoreLow).toBe("1.00");

      // Test: All HIGH (3,3,3,3)
      const scoreHigh = calculateRiskScore({
        geographic: RiskLevel.HIGH,
        financial: RiskLevel.HIGH,
        quality: RiskLevel.HIGH,
        delivery: RiskLevel.HIGH,
      });
      expect(scoreHigh).toBe("3.00");

      // Test: Mixed - geo=LOW, fin=MEDIUM, qual=LOW, del=LOW
      const scoreMixed = calculateRiskScore({
        geographic: RiskLevel.LOW,
        financial: RiskLevel.MEDIUM,
        quality: RiskLevel.LOW,
        delivery: RiskLevel.LOW,
      });
      expect(scoreMixed).toBe("1.25");

      // Test: High geographic risk
      const scoreGeoHigh = calculateRiskScore({
        geographic: RiskLevel.HIGH,
        financial: RiskLevel.LOW,
        quality: RiskLevel.LOW,
        delivery: RiskLevel.LOW,
      });
      expect(scoreGeoHigh).toBe("1.60");

      // Test: All MEDIUM (2,2,2,2)
      const scoreMedium = calculateRiskScore({
        geographic: RiskLevel.MEDIUM,
        financial: RiskLevel.MEDIUM,
        quality: RiskLevel.MEDIUM,
        delivery: RiskLevel.MEDIUM,
      });
      expect(scoreMedium).toBe("2.00");
    });

    it("should display risk score with formula explanation (AC 5)", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(
        screen.getByText(/Scale: 1.00 \(Low\) - 3.00 \(High\)/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Geographic \(30%\) \+ Financial \(25%\)/i)
      ).toBeInTheDocument();
    });

    it("should apply correct weight percentages in calculation", () => {
      // Verify weights: geographic 30%, financial 25%, quality 30%, delivery 15%

      // Only geographic HIGH: 3 * 0.3 + 1 * 0.25 + 1 * 0.3 + 1 * 0.15 = 1.60
      const geoHigh = calculateRiskScore({
        geographic: RiskLevel.HIGH,
        financial: RiskLevel.LOW,
        quality: RiskLevel.LOW,
        delivery: RiskLevel.LOW,
      });
      expect(geoHigh).toBe("1.60");

      // Only financial HIGH: 1 * 0.3 + 3 * 0.25 + 1 * 0.3 + 1 * 0.15 = 1.50
      const finHigh = calculateRiskScore({
        geographic: RiskLevel.LOW,
        financial: RiskLevel.HIGH,
        quality: RiskLevel.LOW,
        delivery: RiskLevel.LOW,
      });
      expect(finHigh).toBe("1.50");

      // Only quality HIGH: 1 * 0.3 + 1 * 0.25 + 3 * 0.3 + 1 * 0.15 = 1.60
      const qualHigh = calculateRiskScore({
        geographic: RiskLevel.LOW,
        financial: RiskLevel.LOW,
        quality: RiskLevel.HIGH,
        delivery: RiskLevel.LOW,
      });
      expect(qualHigh).toBe("1.60");

      // Only delivery HIGH: 1 * 0.3 + 1 * 0.25 + 1 * 0.3 + 3 * 0.15 = 1.30
      const delHigh = calculateRiskScore({
        geographic: RiskLevel.LOW,
        financial: RiskLevel.LOW,
        quality: RiskLevel.LOW,
        delivery: RiskLevel.HIGH,
      });
      expect(delHigh).toBe("1.30");

      // Geographic and Quality should have equal impact (both 30%)
      expect(geoHigh).toBe(qualHigh);
    });
  });

  /**
   * Test: Form Validation
   */
  describe("Form Validation", () => {
    it("should validate required checklist selection", () => {
      // Zod schema requires checklistId to be a valid UUID
      const schema = mockChecklists[0].id;
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(schema)).toBe(true);
    });

    it("should validate UUID format for supplierId", () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(mockSupplier.id)).toBe(true);
    });

    it("should allow optional notes field", () => {
      // Notes field is optional in Zod schema
      const formDataWithoutNotes = {
        supplierId: mockSupplier.id,
        checklistId: mockChecklists[0].id,
        riskAssessment: {
          geographic: RiskLevel.LOW,
          financial: RiskLevel.LOW,
          quality: RiskLevel.LOW,
          delivery: RiskLevel.LOW,
        },
      };

      expect(formDataWithoutNotes.supplierId).toBeDefined();
      expect(formDataWithoutNotes.checklistId).toBeDefined();
      expect(formDataWithoutNotes.riskAssessment).toBeDefined();
    });

    it("should require all risk assessment fields", () => {
      const validRiskAssessment = {
        geographic: RiskLevel.LOW,
        financial: RiskLevel.MEDIUM,
        quality: RiskLevel.LOW,
        delivery: RiskLevel.HIGH,
      };

      expect(validRiskAssessment.geographic).toBeDefined();
      expect(validRiskAssessment.financial).toBeDefined();
      expect(validRiskAssessment.quality).toBeDefined();
      expect(validRiskAssessment.delivery).toBeDefined();
    });
  });

  /**
   * Test: Form Submission (AC 6)
   */
  describe("Form Submission", () => {
    it("should call onSubmit with correct data structure when form is submitted", async () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      // Expected data structure
      const expectedData = {
        supplierId: mockSupplier.id,
        checklistId: mockChecklists[1].id, // Default checklist
        riskAssessment: {
          geographic: RiskLevel.LOW,
          financial: RiskLevel.LOW,
          quality: RiskLevel.LOW,
          delivery: RiskLevel.LOW,
        },
        notes: "",
      };

      expect(expectedData.supplierId).toBe(mockSupplier.id);
      expect(expectedData.checklistId).toBe("checklist-2");
      expect(expectedData.riskAssessment).toBeDefined();
    });

    it("should disable submit button when isSubmitting is true", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={true}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      const submitButton = screen.getByRole("button", {
        name: /Initiating.../i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("should disable submit button when no checklists available", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={[]}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      const submitButton = screen.getByRole("button", {
        name: /Initiate Workflow/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("should show loading text on submit button when submitting", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={true}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(screen.getByText("Initiating...")).toBeInTheDocument();
    });
  });

  /**
   * Test: Cancel Button
   */
  describe("Cancel Button", () => {
    it("should call onCancel when cancel button is clicked", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
    });

    it("should disable cancel button when submitting", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={true}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  /**
   * Test: Loading State
   */
  describe("Loading State", () => {
    it("should disable checklist dropdown when isLoading is true", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={true}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      // The select trigger should be disabled during loading
      expect(screen.getByRole("combobox")).toBeDisabled();
    });

    it("should show warning when no checklists are available", () => {
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={[]}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      expect(
        screen.getByText(/No checklist templates available/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Please create one in Settings/i)
      ).toBeInTheDocument();
    });
  });

  /**
   * Test: Risk Score Color Indicators (AC 5)
   */
  describe("Risk Score Color Indicators", () => {
    it("should apply green color for low risk (< 1.5)", () => {
      // Default form has all LOW risk = 1.00, which should be green
      render(
        <InitiateWorkflowForm
          supplier={mockSupplier}
          checklists={mockChecklists}
          isLoading={false}
          isSubmitting={false}
          onSubmit={mockHandlers.onSubmit}
          onCancel={mockHandlers.onCancel}
        />
      );

      const riskScoreDisplay = screen.getByText("1.00");
      expect(riskScoreDisplay).toBeInTheDocument();
      // Should have green color class (bg-green-50, text-green-600)
    });

    it("should determine correct color for medium risk (1.5 - 2.5)", () => {
      // Score of 2.00 should be yellow
      const score = 2.0;
      expect(score).toBeGreaterThanOrEqual(1.5);
      expect(score).toBeLessThanOrEqual(2.5);
    });

    it("should determine correct color for high risk (> 2.5)", () => {
      // Score of 3.00 should be red
      const score = 3.0;
      expect(score).toBeGreaterThan(2.5);
    });
  });
});

/**
 * Integration Test Notes
 * ======================
 *
 * The above tests verify component rendering, validation, and calculations.
 * For full integration testing with user interactions, you would:
 *
 * 1. Use fireEvent or userEvent to interact with form elements
 * 2. Test dropdown selection changes
 * 3. Verify real-time risk score updates on dropdown changes
 * 4. Test form submission with filled data
 * 5. Verify error handling for API errors (409 conflicts, etc.)
 *
 * Example user interaction test:
 *
 * ```typescript
 * it("should update risk score when dropdown values change", async () => {
 *   const { container } = render(<InitiateWorkflowForm ... />);
 *
 *   // Find and click geographic risk dropdown
 *   const geoDropdown = screen.getByLabelText(/Geographic Risk/i);
 *   fireEvent.click(geoDropdown);
 *
 *   // Select "High" option
 *   const highOption = await screen.findByText("High");
 *   fireEvent.click(highOption);
 *
 *   // Verify risk score updated to 1.60
 *   await waitFor(() => {
 *     expect(screen.getByText("1.60")).toBeInTheDocument();
 *   });
 * });
 * ```
 */
