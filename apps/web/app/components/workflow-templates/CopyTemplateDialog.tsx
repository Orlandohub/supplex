/**
 * Copy Workflow Template Dialog
 * Story 2.2.14 - Copy template functionality
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import {
  errorBody,
  getErrorMessage,
  okBody,
  withTreatyBranch,
} from "~/lib/api-helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  templateDescription?: string | null;
  token: string;
}

export function CopyWorkflowTemplateDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
  templateDescription,
  token,
}: Props) {
  const [name, setName] = useState(`Copy of ${templateName}`);
  const [description, setDescription] = useState(templateDescription || "");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Template name is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const route = client.api["workflow-templates"]({ templateId });
      const trimmedDescription = description.trim();
      const response = await withTreatyBranch(route, "copy").copy.post({
        name: name.trim(),
        ...(trimmedDescription.length > 0
          ? { description: trimmedDescription }
          : {}),
      });

      const err = errorBody(response.error);
      if (err) {
        throw new Error(err.error.message || "Failed to copy template");
      }

      const result = okBody<{ id: string }>(response.data);
      if (!result?.success || !result.data) {
        throw new Error("Failed to copy template");
      }

      toast({
        title: "Template Copied",
        description: `Created draft copy: "${name}"`,
      });

      onOpenChange(false);
      navigate(`/settings/workflow-templates/${result.data.id}/edit`);
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to copy template"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Copy Workflow Template</DialogTitle>
          <DialogDescription>
            Create an editable copy of this workflow template as a new draft.
            All steps, approvers, and settings will be duplicated.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter template description"
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleCopy} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Copy Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
