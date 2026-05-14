/**
 * Copy Form Template Dialog
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
import { useToast } from "~/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import {
  errorBody,
  formTemplatesIndexParamsForTemplateId,
  getErrorMessage,
  okBody,
  withTreatyBranch,
} from "~/lib/api-helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  token: string;
}

export function CopyFormTemplateDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
  token,
}: Props) {
  const [name, setName] = useState(`Copy of ${templateName}`);
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
      const route = client.api["form-templates"](
        formTemplatesIndexParamsForTemplateId(templateId)
      );
      const response = await withTreatyBranch(route, "copy").copy.post({
        name: name.trim(),
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
      navigate(`/settings/form-templates/${result.data.id}/edit`);
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Copy Form Template</DialogTitle>
          <DialogDescription>
            Create an editable copy of this form template as a new draft. All
            sections, fields, and settings will be duplicated.
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
