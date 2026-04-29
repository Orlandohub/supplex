/**
 * Document Templates Management Page
 * Allows admins to view and manage document templates
 * Story 2.2.11
 */

import { data as json, redirect, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator, useNavigate } from "react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import type { DocumentTemplate } from "@supplex/types";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/use-toast";
import { Plus, ArrowLeft } from "lucide-react";
import { DocumentTemplatesTable } from "~/components/document-templates/DocumentTemplatesTable";
import { DocumentTemplateDialog } from "~/components/document-templates/DocumentTemplateDialog";
import { DeleteTemplateDialog } from "~/components/document-templates/DeleteTemplateDialog";

export async function loader(args: LoaderFunctionArgs) {
  // Require authentication
  const { userRecord, session } = await requireAuth(args);

  // Server-side permission check - Admin only
  if (userRecord.role !== UserRole.ADMIN) {
    return redirect("/");
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Create Eden Treaty client
  const client = createEdenTreatyClient(token);

  try {
    // Fetch all document templates
    const templatesResponse = await client.api["document-templates"].get();

    const templates = (templatesResponse.data?.data?.templates ||
      []) as DocumentTemplate[];

    return json({
      templates,
      token,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching document templates:", error);
    return json({
      templates: [] as DocumentTemplate[],
      token,
      error: "Failed to load document templates",
    });
  }
}

export default function DocumentTemplatesPage() {
  const { templates } = useLoaderData<typeof loader>();
  const { session } = useAuth();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Modal states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<DocumentTemplate | null>(null);

  // Filter state
  const [statusFilter, _setStatusFilter] = useState<
    "all" | "draft" | "published" | "archived"
  >("all");

  // Filter templates by status
  const filteredTemplates = templates.filter((template) => {
    if (statusFilter === "all") return true;
    return template.status === statusFilter;
  });

  const handleCreateClick = () => {
    setIsCreateDialogOpen(true);
  };

  const handleEditClick = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateSubmit = async (data: any) => {
    const currentToken = session?.access_token;
    if (!currentToken) {
      toast({
        title: "Error",
        description: "Authentication token not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const client = createClientEdenTreatyClient(currentToken);
      const response = await client.api["document-templates"].post(data);

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to create document template",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Document template created successfully",
      });

      setIsCreateDialogOpen(false);
      revalidator.revalidate();
    } catch (error) {
      console.error("Error creating template:", error);
      toast({
        title: "Error",
        description: "Failed to create document template",
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = async (data: any) => {
    const currentToken = session?.access_token;
    if (!currentToken || !selectedTemplate) {
      toast({
        title: "Error",
        description: "Authentication token not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const client = createClientEdenTreatyClient(currentToken);
      const response = await client.api["document-templates"]({
        id: selectedTemplate.id,
      }).put(data);

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to update document template",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Document template updated successfully",
      });

      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      revalidator.revalidate();
    } catch (error) {
      console.error("Error updating template:", error);
      toast({
        title: "Error",
        description: "Failed to update document template",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    const currentToken = session?.access_token;
    if (!currentToken || !selectedTemplate) {
      toast({
        title: "Error",
        description: "Authentication token not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const client = createClientEdenTreatyClient(currentToken);
      const response = await client.api["document-templates"]({
        id: selectedTemplate.id,
      }).delete();

      if (response.error) {
        const errorData = response.error as any;
        toast({
          title: "Error",
          description:
            errorData.value?.error?.message ||
            "Failed to delete document template",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Document template deleted successfully",
      });

      setIsDeleteDialogOpen(false);
      setSelectedTemplate(null);
      revalidator.revalidate();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: "Failed to delete document template",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Document Templates
          </h1>
          <p className="text-muted-foreground mt-2">
            Define required documents for workflow steps. Templates can be
            reused across multiple workflows.
          </p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <DocumentTemplatesTable
        templates={filteredTemplates}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />

      <DocumentTemplateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateSubmit}
        mode="create"
      />

      <DocumentTemplateDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedTemplate(null);
        }}
        onSubmit={handleEditSubmit}
        mode="edit"
        initialData={selectedTemplate || undefined}
      />

      <DeleteTemplateDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setSelectedTemplate(null);
        }}
        onConfirm={handleDeleteConfirm}
        templateName={selectedTemplate?.templateName || ""}
      />
    </div>
  );
}
