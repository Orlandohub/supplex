/**
 * Workflow Step Timeline Component
 * Story: 2.2.8 - Workflow Execution Engine
 * Updated: 2.2.16 - Validation status visualization
 */

import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

interface StepInstance {
  id: string;
  stepOrder: number;
  stepName: string;
  stepType: string;
  status: string;
  completedDate?: string | null;
}

interface ValidationInfo {
  stepId: string;
  requiresValidation: boolean;
}

interface WorkflowStepTimelineProps {
  steps: StepInstance[];
  validationSteps?: ValidationInfo[];
}

export function WorkflowStepTimeline({ steps, validationSteps }: WorkflowStepTimelineProps) {
  const validationStepIds = new Set(
    (validationSteps || [])
      .filter((v) => v.requiresValidation)
      .map((v) => v.stepId)
  );

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "validated":
        return (
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case "active":
        return (
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white animate-pulse">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case "awaiting_validation":
        return (
          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white animate-pulse">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        );
      case "declined":
        return (
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case "blocked":
        return (
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
            <span className="text-sm font-medium">?</span>
          </div>
        );
    }
  };

  const getStepStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      active: "bg-blue-100 text-blue-800",
      blocked: "bg-gray-100 text-gray-800",
      declined: "bg-red-100 text-red-800",
      awaiting_validation: "bg-amber-100 text-amber-800",
      validated: "bg-green-100 text-green-800",
    };

    const labels: Record<string, string> = {
      awaiting_validation: "Awaiting Validation",
      validated: "Validated",
      declined: "Declined - Resubmission Required",
    };

    return (
      <Badge className={colors[status] || "bg-gray-100 text-gray-800"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const hasValidation = (stepId: string) => validationStepIds.has(stepId);

  const showValidationSubStep = (step: StepInstance) =>
    hasValidation(step.id) && step.status !== "blocked";

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-6">Workflow Progress</h2>
      
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {getStepStatusIcon(step.status)}
              </div>

              {index < steps.length - 1 && (
                <div className="absolute ml-5 mt-10 w-0.5 h-16 bg-gray-300" />
              )}

              <div className="ml-4 flex-1 pb-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Step {step.stepOrder}: {step.stepName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Type: {step.stepType}
                    </p>
                    {step.completedDate && (
                      <p className="text-sm text-gray-500 mt-1">
                        Completed: {new Date(step.completedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {getStepStatusBadge(step.status)}
                </div>

                {/* Validation sub-step */}
                {showValidationSubStep(step) && (
                  <div className="mt-3 ml-2 flex items-center gap-3 pl-4 border-l-2 border-amber-300">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        step.status === "validated"
                          ? "bg-green-500"
                          : step.status === "awaiting_validation"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-gray-300"
                      }`}
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Validation Required</p>
                      <Badge
                        className={
                          step.status === "validated"
                            ? "bg-green-100 text-green-800"
                            : step.status === "awaiting_validation"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-600"
                        }
                      >
                        {step.status === "validated"
                          ? "Validated"
                          : step.status === "awaiting_validation"
                            ? "Awaiting Validation"
                            : "Pending"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
