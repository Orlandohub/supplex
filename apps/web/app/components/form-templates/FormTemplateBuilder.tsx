/**
 * Form Template Builder Component
 * Main orchestrator for building form templates with sections and fields
 * Updated: Story 2.2.14 - Removed versioning, added direct template editing
 */

import { useState } from "react";
import { useRevalidator } from "react-router";
import type { FormSectionWithFieldsUI } from "@supplex/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/hooks/use-toast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { Plus, CheckCircle, Copy } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { AddSectionModal } from "./AddSectionModal";
import { CopyFormTemplateDialog } from "./CopyTemplateDialog";

// Self-contained loader shape for the form-template edit page.
// The serialized payload here does not fit any single canonical domain type
// (drift between @supplex/types and the API projection), so we define the
// observed shape inline. See SUP-7 cluster A for context.
export interface FormTemplateBuilderTemplate {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  sections: FormSectionWithFieldsUI[];
}

interface FormTemplateBuilderProps {
  template: FormTemplateBuilderTemplate;
  token: string;
}

export function FormTemplateBuilder({
  template,
  token,
}: FormTemplateBuilderProps) {
  const revalidator = useRevalidator();
  const { toast } = useToast();

  // Modal states
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const canEdit = template.status === "draft";
  const sections = [...template.sections].sort(
    (a, b) => a.sectionOrder - b.sectionOrder
  );

  const handleAddSection = () => {
    if (!canEdit) {
      toast({
        title: "Cannot Edit",
        description:
          "Published templates cannot be edited. Please copy the template to make changes.",
        variant: "destructive",
      });
      return;
    }
    setIsAddSectionModalOpen(true);
  };

  const handleTogglePublish = async () => {
    if (isPublishing) return;

    if (template.status === "archived") {
      toast({
        title: "Cannot Publish",
        description: "Archived templates cannot be published",
        variant: "destructive",
      });
      return;
    }

    if (template.status === "draft" && sections.length === 0) {
      toast({
        title: "Cannot Publish",
        description: "Add at least one section before publishing",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response =
        await client.api["form-templates"][template.id].publish.patch();

      if (response.error) {
        const errorData = response.error as any;
        toast({
          title: "Error",
          description: errorData?.message || "Failed to toggle publish status",
          variant: "destructive",
        });
        return;
      }

      toast({
        title:
          template.status === "draft"
            ? "Template Published"
            : "Template Unpublished",
        description:
          template.status === "draft"
            ? "Form template is now published and ready for use"
            : "Form template returned to draft status",
      });

      // Small delay to ensure database transaction is committed
      setTimeout(() => {
        revalidator.revalidate();
      }, 100);
    } catch (error) {
      console.error("Error toggling publish status:", error);
      toast({
        title: "Error",
        description: "Failed to update template status",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{template.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {template.status === "published"
                  ? "This template is published and cannot be edited. Copy it to make changes."
                  : template.status === "draft"
                    ? "Draft template - make changes and publish when ready"
                    : "This template is archived"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  template.status === "published" ? "default" : "secondary"
                }
              >
                {template.status.charAt(0).toUpperCase() +
                  template.status.slice(1)}
              </Badge>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCopyDialogOpen(true)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Template
              </Button>

              {template.status !== "archived" && (
                <Button
                  variant={
                    template.status === "published" ? "outline" : "default"
                  }
                  size="sm"
                  onClick={handleTogglePublish}
                  disabled={
                    (template.status === "draft" && sections.length === 0) ||
                    isPublishing
                  }
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {template.status === "published" ? "Unpublish" : "Publish"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Sections</h2>
          {canEdit && (
            <Button onClick={handleAddSection}>
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          )}
        </div>

        {sections.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="mb-4">No sections yet</p>
                {canEdit && (
                  <Button onClick={handleAddSection}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Section
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              templateId={template.id}
              token={token}
              canEdit={canEdit}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
              allSections={sections}
            />
          ))
        )}
      </div>

      {/* Add Section Modal */}
      <AddSectionModal
        open={isAddSectionModalOpen}
        onOpenChange={setIsAddSectionModalOpen}
        templateId={template.id}
        token={token}
        nextOrder={sections.length + 1}
      />

      {/* Copy Template Dialog */}
      <CopyFormTemplateDialog
        open={isCopyDialogOpen}
        onOpenChange={setIsCopyDialogOpen}
        templateId={template.id}
        templateName={template.name}
        token={token}
      />
    </div>
  );
}
