/**
 * Workflow Template Editor Component
 * Main component for editing workflow templates with tabs for metadata and steps
 * Updated: Story 2.2.14 - Removed versioning
 */

import { useState } from "react";
import { useRevalidator } from "react-router";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { WorkflowMetadataEditor } from "./WorkflowMetadataEditor";
import { WorkflowStepBuilder } from "./WorkflowStepBuilder";
import { Badge } from "~/components/ui/badge";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  processType: string;
  status: "draft" | "published" | "archived";
  active: boolean;
  workflowTypeId?: string | null;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface WorkflowTypeOption {
  id: string;
  name: string;
  supplierStatusId: string | null;
}

interface Props {
  template: WorkflowTemplate;
  users: User[];
  workflowTypes?: WorkflowTypeOption[];
  token: string;
}

export function WorkflowTemplateEditor({
  template,
  users,
  workflowTypes = [],
  token,
}: Props) {
  const [activeTab, setActiveTab] = useState("metadata");
  const [isPublishing, setIsPublishing] = useState(false);
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const canEdit = template.status === "draft";

  const handlePublish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response =
        await client.api["workflow-templates"][template.id].publish.patch();

      if (response.error) {
        const body = (
          response.error as { value?: { error?: { message?: string } } }
        )?.value;
        throw new Error(
          body?.error?.message || "Failed to toggle publish status"
        );
      }

      const newStatus = template.status === "draft" ? "published" : "draft";

      toast({
        title:
          newStatus === "published"
            ? "Template Published"
            : "Template Unpublished",
        description:
          newStatus === "published"
            ? "Template is now published and ready for use"
            : "Template returned to draft status",
      });

      // Force page reload to ensure state is updated
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update template status",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Status Badge and Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant={template.status === "published" ? "default" : "secondary"}
          >
            {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
          </Badge>
          {template.status === "published" && !template.active && (
            <Badge variant="outline">Inactive</Badge>
          )}
        </div>

        {/* Action Buttons - Always visible */}
        {template.status !== "archived" && (
          <Button
            variant={template.status === "published" ? "outline" : "default"}
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {template.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
        </TabsList>

        <TabsContent value="metadata" className="space-y-4">
          <WorkflowMetadataEditor
            template={template}
            workflowTypes={workflowTypes}
            token={token}
            onUpdate={() => revalidator.revalidate()}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="steps" className="space-y-4">
          <WorkflowStepBuilder
            templateId={template.id}
            canEdit={canEdit}
            users={users}
            token={token}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
