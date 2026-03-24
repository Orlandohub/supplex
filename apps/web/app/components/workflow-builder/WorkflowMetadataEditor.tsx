/**
 * Workflow Metadata Editor
 * Allows editing of workflow template name and description
 * Updated: Story 2.2.14 - Added publish toggle and canEdit support
 */

import { useState } from "react";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface WorkflowTypeOption {
  id: string;
  name: string;
  supplierStatusId: string | null;
}

interface Props {
  template: {
    id: string;
    name: string;
    description: string | null;
    processType: string;
    workflowTypeId?: string | null;
  };
  workflowTypes?: WorkflowTypeOption[];
  token: string;
  onUpdate: () => void;
  canEdit: boolean;
}

export function WorkflowMetadataEditor({ 
  template, 
  workflowTypes = [],
  token, 
  onUpdate, 
  canEdit 
}: Props) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [workflowTypeId, setWorkflowTypeId] = useState<string | null>(template.workflowTypeId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canEdit) {
      toast({
        title: "Cannot Edit",
        description: "Published templates cannot be edited. Please copy the template to make changes.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api["workflow-templates"][template.id].put({
        name,
        description: description || undefined,
        workflowTypeId: workflowTypeId,
      });

      if (response.error) {
        throw new Error("Failed to update template");
      }

      toast({
        title: "Template Updated",
        description: "Workflow template metadata updated successfully",
      });
      onUpdate();
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update workflow template",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Process Type</Label>
            <div className="text-sm text-muted-foreground">{template.processType}</div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workflowTypeId">Workflow Type (Optional)</Label>
            <Select
              value={workflowTypeId || "__none__"}
              onValueChange={(v) => setWorkflowTypeId(v === "__none__" ? null : v)}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select workflow type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {workflowTypes.map((wt) => (
                  <SelectItem key={wt.id} value={wt.id}>
                    {wt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Workflow type determines behavior on completion (e.g., auto-updating supplier status). Configure types in the Workflow Types tab.
            </p>
          </div>
          <Button type="submit" disabled={isSubmitting || !canEdit}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
          {!canEdit && (
            <p className="text-sm text-muted-foreground">
              Published templates are read-only. Copy this template to make changes.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}




