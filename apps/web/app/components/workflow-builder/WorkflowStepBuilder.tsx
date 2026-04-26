/**
 * Workflow Step Builder Component
 * Manages workflow steps - create, edit, delete, reorder
 * Includes form/document integration and auto-validation configuration
 * Updated: Story 2.2.18 - Removed multi-approver feature
 */

import { useState, useEffect } from "react";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface WorkflowStep {
  id: string;
  stepOrder: number;
  name: string;
  stepType: "form" | "approval" | "document" | "task";
  taskTitle: string | null;
  taskDescription: string | null;
  dueDays: number | null;
  assigneeType: "role" | "user" | null;
  assigneeRole: string | null;
  assigneeUserId: string | null;
  formTemplateId: string | null;
  formActionMode: "fill_out" | "validate" | null;
  documentTemplateId: string | null;
  documentActionMode: "upload" | "validate" | null;
  requiresValidation: boolean;
  validationConfig: {
    approverRoles: string[];
    requireAllApprovals?: boolean;
    validationDueDays?: number;
  } | null;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface Props {
  templateId: string;
  canEdit: boolean;
  users: User[];
  token: string;
}

// Validation schema for step creation/editing
const stepSchema = z
  .object({
    name: z.string().min(1, "Step name is required").max(255),
    stepType: z.enum(["form", "approval", "document", "task"]),
    taskTitle: z.string().max(300).optional(),
    taskDescription: z.string().optional(),
    dueDays: z.number().int().positive().optional().or(z.literal(0)),
    assigneeRole: z.string().max(50).optional(),
    formTemplateId: z.string().optional(),
    documentTemplateId: z.string().optional(),
    requiresValidation: z.boolean().default(false),
    validationApproverRoles: z.array(z.string()).optional(),
    validationDueDays: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requiresValidation) {
      if (
        !data.validationApproverRoles ||
        data.validationApproverRoles.length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "At least one approver role is required when validation is enabled",
          path: ["validationApproverRoles"],
        });
      }
    }
    if (data.stepType === "form" && !data.formTemplateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A form template is required for form steps",
        path: ["formTemplateId"],
      });
    }
    if (data.stepType === "document" && !data.documentTemplateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A document template is required for document steps",
        path: ["documentTemplateId"],
      });
    }
  });

type StepFormData = z.output<typeof stepSchema>;
type StepFormInput = z.input<typeof stepSchema>;

interface TemplateOption {
  id: string;
  label: string;
}

export function WorkflowStepBuilder({
  templateId,
  canEdit,
  users: _users,
  token,
}: Props) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [formTemplates, setFormTemplates] = useState<TemplateOption[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<TemplateOption[]>(
    []
  );
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const form = useForm<StepFormInput, unknown, StepFormData>({
    resolver: zodResolver(stepSchema),
    defaultValues: {
      name: "",
      stepType: "form",
    },
  });

  // Fetch steps when component mounts
  useEffect(() => {
    fetchSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // Fetch published form and document templates when dialog opens or on mount for read-only
  useEffect(() => {
    if (isDialogOpen && !isLoadingTemplates && formTemplates.length === 0) {
      fetchPublishedTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen]);

  // For published templates (read-only), fetch template names on mount
  useEffect(() => {
    if (!canEdit && formTemplates.length === 0) {
      fetchPublishedTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const fetchPublishedTemplates = async () => {
    setIsLoadingTemplates(true);
    const client = createClientEdenTreatyClient(token);

    try {
      // Fetch published form templates
      const formResponse = await client.api["form-templates"].published.get();
      if (formResponse.data?.success) {
        setFormTemplates(formResponse.data.data.templates as TemplateOption[]);
      }

      // Fetch published document templates
      const docResponse =
        await client.api["document-templates"].published.get();
      if (docResponse.data?.success) {
        setDocumentTemplates(
          docResponse.data.data.templates as TemplateOption[]
        );
      }
    } catch (error) {
      console.error("Error fetching published templates:", error);
      toast({
        title: "Warning",
        description: "Failed to load template options",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const fetchSteps = async () => {
    setIsLoading(true);
    const client = createClientEdenTreatyClient(token);

    try {
      const response = await (client.api["workflow-templates"] as any)[
        templateId
      ].steps.get();

      if (response.error) {
        throw new Error("Failed to fetch steps");
      }

      const stepsData = (response.data?.data || []) as WorkflowStep[];
      setSteps(stepsData.sort((a, b) => a.stepOrder - b.stepOrder));
    } catch (error) {
      console.error("Error fetching steps:", error);
      toast({
        title: "Error",
        description: "Failed to load workflow steps",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (step?: WorkflowStep) => {
    if (step) {
      setEditingStep(step);
      form.reset({
        name: step.name,
        stepType: step.stepType,
        taskTitle: step.taskTitle || undefined,
        taskDescription: step.taskDescription || undefined,
        dueDays: step.dueDays || undefined,
        assigneeRole: step.assigneeRole || undefined,
        formTemplateId: step.formTemplateId || undefined,
        documentTemplateId: step.documentTemplateId || undefined,
        requiresValidation: step.requiresValidation || false,
        validationApproverRoles: step.validationConfig?.approverRoles || [],
        validationDueDays:
          step.validationConfig?.validationDueDays || undefined,
      });
    } else {
      setEditingStep(null);
      form.reset({
        name: "",
        stepType: "form",
        requiresValidation: false,
        validationApproverRoles: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStep(null);
    form.reset();
  };

  const onSubmit = async (data: StepFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const client = createClientEdenTreatyClient(token);

    // Auto-set action modes based on step type
    const formActionMode = data.formTemplateId ? "fill_out" : null;
    const documentActionMode = data.documentTemplateId ? "upload" : null;

    // Force assigneeType to 'role' and assigneeUserId to null
    // Transform validationApproverRoles into validationConfig
    const stepData = {
      ...data,
      assigneeType: "role" as const,
      assigneeUserId: null,
      formActionMode,
      documentActionMode,
      validationConfig:
        data.requiresValidation && data.validationApproverRoles
          ? {
              approverRoles: data.validationApproverRoles,
              ...(data.validationDueDays
                ? { validationDueDays: data.validationDueDays }
                : {}),
            }
          : undefined,
    };

    // Remove the temporary fields used for the form
    delete (stepData as any).validationApproverRoles;
    delete (stepData as any).validationDueDays;

    try {
      if (editingStep) {
        // Update existing step
        const response = await (client.api["workflow-templates"] as any)[
          templateId
        ].steps[editingStep.id].put(stepData);

        if (response.error) {
          throw new Error("Failed to update step");
        }

        toast({
          title: "Step Updated",
          description: "Workflow step updated successfully",
        });
      } else {
        // Create new step
        const response = await (client.api["workflow-templates"] as any)[
          templateId
        ].steps.post(stepData);

        if (response.error) {
          throw new Error("Failed to create step");
        }

        toast({
          title: "Step Created",
          description: "New workflow step created successfully",
        });
      }

      handleCloseDialog();
      fetchSteps();
    } catch (error) {
      console.error("Error saving step:", error);
      toast({
        title: "Error",
        description: "Failed to save workflow step. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (deletingStepId) return;
    setDeletingStepId(stepId);

    const client = createClientEdenTreatyClient(token);

    try {
      const response = await (client.api["workflow-templates"] as any)[
        templateId
      ].steps[stepId].delete();

      if (response.error) {
        throw new Error("Failed to delete step");
      }

      toast({
        title: "Step Deleted",
        description: "Workflow step deleted successfully",
      });

      fetchSteps();
    } catch (error) {
      console.error("Error deleting step:", error);
      toast({
        title: "Error",
        description: "Failed to delete workflow step",
        variant: "destructive",
      });
    } finally {
      setDeletingStepId(null);
    }
  };

  const handleReorderStep = async (
    stepId: string,
    direction: "up" | "down"
  ) => {
    if (isReordering) return;

    if (!canEdit) {
      toast({
        title: "Cannot Reorder",
        description: "Cannot reorder steps in published workflow",
        variant: "destructive",
      });
      return;
    }

    const currentIndex = steps.findIndex((s) => s.id === stepId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    // Boundary checks
    if (newIndex < 0 || newIndex >= steps.length) return;

    setIsReordering(true);

    // Create reordered array
    const reordered = Array.from(steps);
    const [movedStep] = reordered.splice(currentIndex, 1);
    if (!movedStep) {
      setIsReordering(false);
      return;
    }
    reordered.splice(newIndex, 0, movedStep);

    // Create update payload with new step orders
    const updates = reordered.map((step, index) => ({
      stepId: step.id,
      order: index + 1,
    }));

    const client = createClientEdenTreatyClient(token);

    try {
      const response = await (client.api["workflow-templates"] as any)[
        templateId
      ].steps.reorder.put({
        stepOrders: updates,
      });

      if (response.error) {
        throw new Error("Failed to reorder steps");
      }

      toast({
        title: "Steps Reordered",
        description: "Step order updated successfully",
      });

      fetchSteps();
    } catch (error) {
      console.error("Error reordering steps:", error);
      toast({
        title: "Error",
        description: "Failed to reorder steps. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReordering(false);
    }
  };

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const getTemplateName = (
    templateId: string | null,
    templates: TemplateOption[]
  ): string | null => {
    if (!templateId) return null;
    return templates.find((t) => t.id === templateId)?.label || templateId;
  };

  const getStepTypeBadgeVariant = (stepType: string) => {
    switch (stepType) {
      case "form":
        return "default";
      case "approval":
        return "secondary";
      case "document":
        return "outline";
      default:
        return "secondary";
    }
  };

  const watchStepType = form.watch("stepType");
  const watchAssigneeRole = form.watch("assigneeRole");
  const watchRequiresValidation = form.watch("requiresValidation");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Workflow Steps</h3>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Configure the steps for this workflow version"
              : "This version is published and cannot be edited"}
          </p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          disabled={!canEdit || isLoading}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </div>

      {/* Immutability Warning */}
      {!canEdit && (
        <Card className="border-yellow-500/50 bg-yellow-50/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Published Version</p>
                <p className="text-sm text-muted-foreground">
                  This version is immutable. Create a new draft version to make
                  changes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading steps...</p>
          </CardContent>
        </Card>
      ) : steps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              No steps configured yet
            </p>
            {canEdit && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Step
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            return (
              <Card
                key={step.id}
                className={
                  !canEdit
                    ? "cursor-pointer transition-colors hover:border-muted-foreground/50"
                    : ""
                }
                onClick={
                  !canEdit ? () => toggleStepExpanded(step.id) : undefined
                }
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {!canEdit && (
                        <div className="flex items-center gap-2 mt-1">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                        </div>
                      )}
                      {canEdit && (
                        <div className="flex flex-col items-center gap-1 mt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleReorderStep(step.id, "up")}
                            disabled={index === 0 || isReordering}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleReorderStep(step.id, "down")}
                            disabled={
                              index === steps.length - 1 || isReordering
                            }
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base">{step.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {step.taskTitle || "No task title"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStepTypeBadgeVariant(step.stepType)}>
                        {step.stepType}
                      </Badge>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(step)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStep(step.id)}
                            disabled={deletingStepId === step.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {canEdit && step.taskDescription && (
                      <p className="text-muted-foreground">
                        {step.taskDescription}
                      </p>
                    )}
                    {canEdit && (
                      <div className="flex flex-wrap gap-4">
                        {step.dueDays && (
                          <div>
                            <span className="font-medium">Due:</span>{" "}
                            {step.dueDays} days
                          </div>
                        )}
                        {step.assigneeRole && (
                          <div>
                            <span className="font-medium">Assignee Role:</span>{" "}
                            {step.assigneeRole}
                          </div>
                        )}
                        {step.formTemplateId && (
                          <div>
                            <span className="font-medium">Form:</span>{" "}
                            {step.formActionMode}
                          </div>
                        )}
                        {step.documentTemplateId && (
                          <div>
                            <span className="font-medium">Document:</span>{" "}
                            {step.documentActionMode}
                          </div>
                        )}
                        {step.requiresValidation && (
                          <div>
                            <span className="font-medium">
                              Auto-Validation:
                            </span>{" "}
                            {step.validationConfig?.approverRoles?.join(", ") ||
                              "configured"}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Read-only expanded detail view for published templates */}
                    {!canEdit && isExpanded && (
                      <div className="space-y-3 pt-2 border-t">
                        {step.taskDescription && (
                          <div>
                            <span className="font-medium text-muted-foreground">
                              Description
                            </span>
                            <p className="mt-1">{step.taskDescription}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {step.dueDays != null && (
                            <div>
                              <span className="font-medium text-muted-foreground">
                                Due Days
                              </span>
                              <p className="mt-1">{step.dueDays} days</p>
                            </div>
                          )}
                          {step.assigneeRole && (
                            <div>
                              <span className="font-medium text-muted-foreground">
                                Assignee Role
                              </span>
                              <p className="mt-1">{step.assigneeRole}</p>
                            </div>
                          )}
                          {step.formTemplateId && (
                            <div>
                              <span className="font-medium text-muted-foreground">
                                Form Template
                              </span>
                              <p className="mt-1">
                                {getTemplateName(
                                  step.formTemplateId,
                                  formTemplates
                                ) || "Loading..."}
                              </p>
                            </div>
                          )}
                          {step.formActionMode && (
                            <div>
                              <span className="font-medium text-muted-foreground">
                                Form Action
                              </span>
                              <p className="mt-1">
                                {step.formActionMode === "fill_out"
                                  ? "Fill Out"
                                  : "Validate"}
                              </p>
                            </div>
                          )}
                          {step.documentTemplateId && (
                            <div>
                              <span className="font-medium text-muted-foreground">
                                Document Template
                              </span>
                              <p className="mt-1">
                                {getTemplateName(
                                  step.documentTemplateId,
                                  documentTemplates
                                ) || "Loading..."}
                              </p>
                            </div>
                          )}
                          {step.documentActionMode && (
                            <div>
                              <span className="font-medium text-muted-foreground">
                                Document Action
                              </span>
                              <p className="mt-1">
                                {step.documentActionMode === "upload"
                                  ? "Upload"
                                  : "Validate"}
                              </p>
                            </div>
                          )}
                        </div>
                        {step.requiresValidation && (
                          <div>
                            <span className="font-medium text-muted-foreground">
                              Auto-Validation
                            </span>
                            <p className="mt-1">
                              Approver Roles:{" "}
                              {step.validationConfig?.approverRoles?.join(
                                ", "
                              ) || "None configured"}
                              {step.validationConfig?.validationDueDays && (
                                <span className="ml-2">
                                  ({step.validationConfig.validationDueDays}{" "}
                                  days to review)
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Compact summary for read-only when collapsed */}
                    {!canEdit && !isExpanded && (
                      <div className="flex flex-wrap gap-4 text-muted-foreground">
                        {step.dueDays && <span>{step.dueDays}d</span>}
                        {step.assigneeRole && <span>{step.assigneeRole}</span>}
                        {step.formTemplateId && <span>Form</span>}
                        {step.documentTemplateId && <span>Document</span>}
                        {step.requiresValidation && <span>Validation</span>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Step Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStep ? "Edit Step" : "Create New Step"}
            </DialogTitle>
            <DialogDescription>
              Configure the workflow step details, assignees, and integrations
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Step Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Step Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Review Supplier Profile"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Step Type */}
              <FormField
                control={form.control}
                name="stepType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Step Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select step type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="form">Form</SelectItem>
                        <SelectItem value="document">Document</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Task Title */}
              <FormField
                control={form.control}
                name="taskTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Complete supplier information"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The title shown to users when they receive this task
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Task Description */}
              <FormField
                control={form.control}
                name="taskDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide detailed instructions for this task..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Days */}
              <FormField
                control={form.control}
                name="dueDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="7"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        disabled={!canEdit}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of days to complete this task (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assignee Role - Always Visible */}
              <FormField
                control={form.control}
                name="assigneeRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="procurement_manager">
                          Procurement Manager
                        </SelectItem>
                        <SelectItem value="quality_manager">
                          Quality Manager
                        </SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="supplier_user">
                          Supplier User
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {watchAssigneeRole === "supplier_user"
                        ? "Tasks will be automatically assigned to the supplier's platform access contact. This option only works for supplier-related workflows."
                        : "All users with this role will be assigned to tasks for this step"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Form Integration (if step type involves forms) */}
              {(watchStepType === "form" || watchStepType === "approval") && (
                <>
                  <FormField
                    control={form.control}
                    name="formTemplateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Form Template {watchStepType === "form" ? "*" : ""}
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoadingTemplates}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  isLoadingTemplates
                                    ? "Loading templates..."
                                    : formTemplates.length === 0
                                      ? "No published templates available"
                                      : "Select form template..."
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {formTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.label}
                              </SelectItem>
                            ))}
                            {formTemplates.length === 0 &&
                              !isLoadingTemplates && (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No published form templates available
                                </div>
                              )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select a published form template to attach to this
                          step. Forms will be completed by the assigned user.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Document Integration */}
              {watchStepType === "document" && (
                <>
                  <FormField
                    control={form.control}
                    name="documentTemplateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Template *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoadingTemplates}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  isLoadingTemplates
                                    ? "Loading templates..."
                                    : documentTemplates.length === 0
                                      ? "No published templates available"
                                      : "Select document template..."
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {documentTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.label}
                              </SelectItem>
                            ))}
                            {documentTemplates.length === 0 &&
                              !isLoadingTemplates && (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No published document templates available
                                </div>
                              )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select a published document template to attach to this
                          step. Documents will be uploaded by the assigned user.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Auto-Validation Toggle (Story 2.2.15) */}
              <FormField
                control={form.control}
                name="requiresValidation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Requires Validation?</FormLabel>
                      <FormDescription>
                        When checked, validation tasks will be automatically
                        created when this step completes
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Conditional: Validation Approver Roles + Due Days */}
              {watchRequiresValidation && (
                <>
                  <FormField
                    control={form.control}
                    name="validationApproverRoles"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validation Approver Roles *</FormLabel>
                        <FormDescription>
                          Select which roles can approve this validation. All
                          selected roles will receive a validation task.
                        </FormDescription>
                        <div className="space-y-2">
                          {[
                            "admin",
                            "procurement_manager",
                            "quality_manager",
                          ].map((role) => (
                            <div
                              key={role}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`validation-role-${role}`}
                                checked={field.value?.includes(role)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, role]);
                                  } else {
                                    field.onChange(
                                      current.filter((r: string) => r !== role)
                                    );
                                  }
                                }}
                              />
                              <label
                                htmlFor={`validation-role-${role}`}
                                className="text-sm font-medium leading-none"
                              >
                                {role === "admin"
                                  ? "Admin"
                                  : role === "procurement_manager"
                                    ? "Procurement Manager"
                                    : "Quality Manager"}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="validationDueDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validation Due Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="3"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val ? Number(val) : undefined);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Number of days validators have to complete their
                          review (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {editingStep ? "Update Step" : "Create Step"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
