import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Card } from "~/components/ui/card";
import type { DocumentChecklist } from "@supplex/types";
import { calculateRiskScore, getRiskScoreClassName } from "@supplex/types";

interface InitiateWorkflowFormProps {
  supplier: {
    id: string;
    name: string;
  };
  checklists: DocumentChecklist[];
  isLoading: boolean;
  isSubmitting: boolean;
  onSubmit: (data: WorkflowFormData) => void;
  onCancel: () => void;
}

// Types for form data
interface WorkflowFormData {
  supplierId: string;
  checklistId: string;
  riskAssessment: {
    geographic: string;
    financial: string;
    quality: string;
    delivery: string;
  };
  notes?: string;
}

// Zod schema for validation (AC 3-4)
const initiateWorkflowSchema = z.object({
  supplierId: z.string().uuid(),
  checklistId: z
    .string()
    .uuid({ message: "Please select a checklist template" }),
  riskAssessment: z.object({
    geographic: z.enum(["low", "medium", "high"], {
      required_error: "Please select geographic risk level",
    }),
    financial: z.enum(["low", "medium", "high"], {
      required_error: "Please select financial risk level",
    }),
    quality: z.enum(["low", "medium", "high"], {
      required_error: "Please select quality risk level",
    }),
    delivery: z.enum(["low", "medium", "high"], {
      required_error: "Please select delivery risk level",
    }),
  }),
  notes: z.string().optional(),
});

type InitiateWorkflowFormData = z.infer<typeof initiateWorkflowSchema>;

/**
 * Initiate Workflow Form Component (AC 3-7, 10)
 * Form for initiating a qualification workflow with risk assessment
 *
 * Features:
 * - Checklist template selection (defaults to tenant default)
 * - Risk assessment with 4 categories
 * - Real-time risk score calculation
 * - Notes field
 * - Form validation with inline errors
 */
export function InitiateWorkflowForm({
  supplier,
  checklists,
  isLoading,
  isSubmitting,
  onSubmit,
  onCancel,
}: InitiateWorkflowFormProps) {
  // Find default checklist
  const defaultChecklist = checklists.find((c) => c.isDefault);

  const form = useForm<InitiateWorkflowFormData>({
    resolver: zodResolver(initiateWorkflowSchema),
    defaultValues: {
      supplierId: supplier.id,
      checklistId: defaultChecklist?.id || "",
      riskAssessment: {
        geographic: "low",
        financial: "low",
        quality: "low",
        delivery: "low",
      },
      notes: "",
    },
  });

  // Watch risk assessment values for real-time calculation (AC 5)
  const riskAssessment = form.watch("riskAssessment");

  // Calculate risk score in real-time using shared utility (AC 5)
  const calculatedRiskScore = useMemo(() => {
    return calculateRiskScore(riskAssessment);
  }, [riskAssessment]);

  const handleFormSubmit = (data: InitiateWorkflowFormData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Supplier Name (Read-only) */}
      <div>
        <Label>Supplier</Label>
        <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
          {supplier.name}
        </div>
      </div>

      {/* Checklist Template Dropdown (AC 3) */}
      <div>
        <Label htmlFor="checklistId">
          Document Checklist Template <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.watch("checklistId")}
          onValueChange={(value) => form.setValue("checklistId", value)}
          disabled={isLoading || checklists.length === 0}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a checklist template" />
          </SelectTrigger>
          <SelectContent>
            {checklists.map((checklist) => (
              <SelectItem key={checklist.id} value={checklist.id}>
                {checklist.templateName}
                {checklist.isDefault && " (Default)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.checklistId && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.checklistId.message}
          </p>
        )}
        {!isLoading && checklists.length === 0 && (
          <p className="mt-1 text-sm text-yellow-600">
            No checklist templates available. Please create one in Settings.
          </p>
        )}
      </div>

      {/* Risk Assessment Section (AC 4) */}
      <Card className="p-4 space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Risk Assessment</h3>
          <p className="text-sm text-gray-600 mb-4">
            Assess the risk levels for different categories.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Geographic Risk */}
          <div>
            <Label htmlFor="geographic">
              Geographic Risk <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.watch("riskAssessment.geographic")}
              onValueChange={(value) =>
                form.setValue("riskAssessment.geographic", value as any)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Financial Risk */}
          <div>
            <Label htmlFor="financial">
              Financial Risk <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.watch("riskAssessment.financial")}
              onValueChange={(value) =>
                form.setValue("riskAssessment.financial", value as any)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quality Risk */}
          <div>
            <Label htmlFor="quality">
              Quality Risk <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.watch("riskAssessment.quality")}
              onValueChange={(value) =>
                form.setValue("riskAssessment.quality", value as any)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Risk */}
          <div>
            <Label htmlFor="delivery">
              Delivery Risk <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.watch("riskAssessment.delivery")}
              onValueChange={(value) =>
                form.setValue("riskAssessment.delivery", value as any)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Overall Risk Score Display (AC 5) */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Overall Risk Score:
            </span>
            <span
              className={`text-2xl font-bold px-4 py-2 rounded-md ${getRiskScoreClassName(
                calculatedRiskScore
              )}`}
            >
              {calculatedRiskScore}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Scale: 1.00 (Low) - 3.00 (High) | Calculation: Geographic (30%) +
            Financial (25%) + Quality (30%) + Delivery (15%)
          </p>
        </div>
      </Card>

      {/* Notes Field */}
      <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          {...form.register("notes")}
          placeholder="Add any additional notes about this qualification workflow..."
          rows={3}
          className="mt-1"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || checklists.length === 0}
        >
          {isSubmitting ? "Initiating..." : "Initiate Workflow"}
        </Button>
      </div>
    </form>
  );
}
