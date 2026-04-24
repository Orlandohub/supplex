/**
 * Multi-Approver Configuration Component
 * Manages approvers for multi-approver workflow steps
 * Updated: Story 2.2.14 - Removed versioning
 */

import { useState, useEffect } from "react";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { Button } from "~/components/ui/button";
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
import { Plus, Trash2, Users, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface StepApprover {
  id: string;
  approverOrder: number;
  approverType: "role" | "user";
  approverRole: string | null;
  approverUserId: string | null;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface Props {
  templateId: string;
  stepId: string;
  approverCount: number;
  users: User[];
  token: string;
}

// Validation schema for role-based approver creation
const approverSchema = z.object({
  approverRole: z.string().min(1, "Role is required"),
});

type ApproverFormData = z.infer<typeof approverSchema>;

export function MultiApproverConfig({
  templateId,
  stepId,
  approverCount,
  users: _users,
  token,
}: Props) {
  const [approvers, setApprovers] = useState<StepApprover[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<ApproverFormData>({
    resolver: zodResolver(approverSchema),
    defaultValues: {},
  });

  // Fetch approvers when component mounts
  useEffect(() => {
    fetchApprovers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

  const fetchApprovers = async () => {
    setIsLoading(true);
    const client = createClientEdenTreatyClient(token);

    try {
      const response = await (client.api["workflow-templates"] as any)[
        templateId
      ].steps[stepId].approvers.get();

      if (response.error) {
        throw new Error("Failed to fetch approvers");
      }

      const approversData = (response.data?.data || []) as StepApprover[];
      setApprovers(
        approversData.sort((a, b) => a.approverOrder - b.approverOrder)
      );
    } catch (error) {
      console.error("Error fetching approvers:", error);
      toast({
        title: "Error",
        description: "Failed to load approvers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = () => {
    form.reset({});
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    form.reset();
  };

  const onSubmit = async (data: ApproverFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const client = createClientEdenTreatyClient(token);

    try {
      const response = await (client.api["workflow-templates"] as any)[
        templateId
      ].steps[stepId].approvers.post({
        approverType: "role",
        approverRole: data.approverRole,
        approverUserId: null,
      });

      if (response.error) {
        throw new Error("Failed to add approver");
      }

      toast({
        title: "Role Added",
        description: "New role added successfully",
      });

      handleCloseDialog();
      fetchApprovers();
    } catch (error) {
      console.error("Error adding approver:", error);
      toast({
        title: "Error",
        description: "Failed to add role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteApprover = async (approverId: string) => {
    if (isDeletingId) return;
    setIsDeletingId(approverId);
    const client = createClientEdenTreatyClient(token);

    try {
      const response = await (client.api["workflow-templates"] as any)[
        templateId
      ].steps[stepId].approvers[approverId].delete();

      if (response.error) {
        throw new Error("Failed to delete approver");
      }

      toast({
        title: "Approver Removed",
        description: "Approver removed successfully",
      });

      fetchApprovers();
    } catch (error) {
      console.error("Error deleting approver:", error);
      toast({
        title: "Error",
        description: "Failed to remove approver",
        variant: "destructive",
      });
    } finally {
      setIsDeletingId(null);
    }
  };

  const getApproverDisplayName = (approver: StepApprover) => {
    return approver.approverRole || "Unknown Role";
  };

  // Check if approver requirement is met
  const isRequirementMet = approvers.length >= approverCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h4 className="text-sm font-semibold">
              Multiple Roles Configuration
            </h4>
            <p className="text-xs text-muted-foreground">
              Requires {approverCount} out of {approvers.length} approvals
            </p>
          </div>
        </div>
        <Button onClick={handleOpenDialog} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      {/* Requirement Status */}
      {!isRequirementMet && (
        <div className="flex items-start gap-3 p-3 bg-yellow-50/10 border border-yellow-500/50 rounded-md">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Incomplete Configuration</p>
            <p className="text-xs text-muted-foreground">
              You need at least {approverCount} role(s). Currently have{" "}
              {approvers.length}.
            </p>
          </div>
        </div>
      )}

      {/* Roles List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Loading roles...
        </p>
      ) : approvers.length === 0 ? (
        <div className="text-center py-6 border rounded-md border-dashed">
          <p className="text-sm text-muted-foreground mb-2">
            No roles configured
          </p>
          <Button onClick={handleOpenDialog} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add First Role
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {approvers.map((approver, index) => (
            <div
              key={approver.id}
              className="flex items-center justify-between p-3 border rounded-md hover:border-muted-foreground/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {getApproverDisplayName(approver)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Role-based approver
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeletingId === approver.id}
                onClick={() => handleDeleteApprover(approver.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>
              Add a role as an approver for this step
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Role Selection */}
              <FormField
                control={form.control}
                name="approverRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Role</FormLabel>
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
                      All users with this role will be able to approve
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Add Role
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
