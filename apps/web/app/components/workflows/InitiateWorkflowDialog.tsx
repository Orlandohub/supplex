/**
 * Initiate Workflow Dialog (NEW WORKFLOW ENGINE)
 * Modal for starting a workflow process from a template
 * Updated: Story 2.2.14 - Uses workflowTemplateId instead of versionId
 *
 * Supports two usage patterns:
 * 1. Trigger-based (for global workflows page): Pass children as trigger
 * 2. Controlled (for supplier detail page): Pass open/onOpenChange
 *
 * Replaces legacy checklist-based workflow initiation
 * Uses new workflow template system
 */

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { useRevalidator } from "react-router";
import { useToast } from "~/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  status: "draft" | "published" | "archived";
  active: boolean;
}

interface Supplier {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  [key: string]: any;
}

// Props for trigger-based usage (new pattern for global workflows page)
interface TriggerBasedProps {
  children: ReactNode;
  token: string;
  user: User;
  supplier?: never;
  open?: never;
  onOpenChange?: never;
}

// Props for controlled usage (legacy pattern for supplier detail page)
interface ControlledProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier;
  token: string;
  children?: never;
  user?: never;
}

type InitiateWorkflowDialogProps = TriggerBasedProps | ControlledProps;

/**
 * Initiate Workflow Dialog (NEW WORKFLOW ENGINE)
 * Modal for starting a workflow process from a template
 *
 * Supports two usage patterns:
 * 1. Trigger-based (for global workflows page): Pass children as trigger
 * 2. Controlled (for supplier detail page): Pass open/onOpenChange
 *
 * Replaces legacy checklist-based workflow initiation
 * Uses new workflow template system
 */
export function InitiateWorkflowDialog(props: InitiateWorkflowDialogProps) {
  // Determine if this is trigger-based or controlled
  const isTriggerBased = "children" in props && props.children !== undefined;

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuppliers, setIsFetchingSuppliers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const revalidator = useRevalidator();
  const { toast } = useToast();

  // Get the actual open state and setter based on pattern
  const open = isTriggerBased ? internalOpen : props.open;
  const setOpen = isTriggerBased
    ? setInternalOpen
    : (props.onOpenChange ?? setInternalOpen);

  // Get supplier from props (controlled) or selection (trigger-based)
  const preselectedSupplier = !isTriggerBased ? props.supplier : null;
  const token = props.token;

  // Fetch suppliers (only for trigger-based pattern)
  useEffect(() => {
    if (open && isTriggerBased) {
      fetchSuppliers();
    }
  }, [open, isTriggerBased]);

  // Fetch active published workflow templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
      // Reset selection when reopening
      setSelectedTemplateId("");
      if (isTriggerBased) {
        setSelectedSupplierId("");
      }
    }
  }, [open, isTriggerBased]);

  const fetchSuppliers = async () => {
    setIsFetchingSuppliers(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.suppliers.get({
        query: {
          limit: 100, // API max limit
          page: 1,
        },
      });

      if (response.error) {
        throw new Error("Failed to load suppliers");
      }

      const apiResponse = response.data as {
        success: boolean;
        data: {
          suppliers: Supplier[];
        };
      };

      setSuppliers(apiResponse.data.suppliers || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load suppliers",
        variant: "destructive",
      });
      console.error("Error fetching suppliers:", error);
    } finally {
      setIsFetchingSuppliers(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api["workflow-templates"].get({
        query: {
          active: true, // Only active templates
          limit: 100,
          offset: 0,
        },
      });

      if (response.error) {
        throw new Error("Failed to load workflow templates");
      }

      const apiResponse = response.data as {
        success: boolean;
        data: WorkflowTemplate[];
      };

      // Filter to only published and active templates
      const publishedTemplates = (apiResponse.data || []).filter(
        (template) => template.status === "published" && template.active
      );

      setTemplates(publishedTemplates);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load workflow templates",
        variant: "destructive",
      });
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplateId) {
      toast({
        title: "Error",
        description: "Please select a workflow template",
        variant: "destructive",
      });
      return;
    }

    // Get supplier (either preselected or user-selected)
    const targetSupplier =
      preselectedSupplier || suppliers.find((s) => s.id === selectedSupplierId);

    if (!targetSupplier) {
      toast({
        title: "Error",
        description: "Please select a supplier",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const client = createClientEdenTreatyClient(token);

      // Find selected template
      const selectedTemplate = templates.find(
        (t) => t.id === selectedTemplateId
      );

      if (!selectedTemplate) {
        throw new Error("Selected template not found");
      }

      // Call new workflow engine instantiation API with templateId
      const response = await client.api.workflows.instantiate.post({
        workflowTemplateId: selectedTemplate.id,
        entityType: "supplier",
        entityId: targetSupplier.id,
        metadata: {
          supplierName: targetSupplier.name,
          processType: "supplier_workflow",
        },
      });

      if (response.error) {
        throw new Error("Failed to start workflow");
      }

      toast({
        title: `Workflow started for ${targetSupplier.name}`,
        description: `${selectedTemplate.name} is now in progress`,
      });

      revalidator.revalidate();
      setOpen(false);
      setSelectedTemplateId("");
      setSelectedSupplierId("");
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start workflow",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogContent = (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Start Workflow Process</DialogTitle>
        <DialogDescription>
          {preselectedSupplier
            ? `Select a workflow template to start for ${preselectedSupplier.name}`
            : "Select a supplier and workflow template to start a new process"}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Supplier Selection (only for trigger-based pattern) */}
        {isTriggerBased && (
          <div className="space-y-2">
            <Label htmlFor="supplier-select">Supplier</Label>
            {isFetchingSuppliers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No suppliers available. Please create a supplier first.
              </p>
            ) : (
              <Select
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger id="supplier-select">
                  <SelectValue placeholder="Select a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Template Selection */}
        <div className="space-y-2">
          <Label htmlFor="template-select">Workflow Template</Label>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No active workflow templates available. Please create and publish
              a template first.
            </p>
          ) : (
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
            >
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Select a workflow template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedTemplateId && (
          <div className="rounded-md bg-blue-50 p-3">
            <p className="text-sm text-blue-900 mb-2">
              {templates.find((t) => t.id === selectedTemplateId)?.description}
            </p>
            <Badge variant="default" className="text-xs">
              Published & Active
            </Badge>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            !selectedTemplateId ||
            (isTriggerBased && !selectedSupplierId) ||
            isSubmitting ||
            templates.length === 0 ||
            (isTriggerBased && suppliers.length === 0)
          }
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            "Start Workflow"
          )}
        </Button>
      </div>
    </DialogContent>
  );

  // Render with trigger or controlled
  if (isTriggerBased) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{props.children}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {dialogContent}
    </Dialog>
  );
}
