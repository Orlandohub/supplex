/**
 * Form Templates Management Page
 * Allows admins to view and manage form templates
 */

import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useRevalidator } from "@remix-run/react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import type { FormTemplateListItem } from "@supplex/types";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "~/hooks/use-toast";
import { Plus, ArrowLeft } from "lucide-react";
import { FormTemplateTable } from "~/components/form-templates/FormTemplateTable";
import { CreateTemplateModal } from "~/components/form-templates/CreateTemplateModal";

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
    // Fetch all form templates
    const templatesResponse = await client.api["form-templates"].get();

    const templates = (templatesResponse.data?.data?.templates || []) as FormTemplateListItem[];

    return json({
      templates,
      token,
      error: null,
    });
  } catch (error) {
    console.error("Error fetching form templates:", error);
    return json({
      templates: [] as FormTemplateListItem[],
      token,
      error: "Failed to load form templates",
    });
  }
}

export default function FormTemplatesPage() {
  const { templates, token } = useLoaderData<typeof loader>();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const { toast } = useToast();
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">("all");

  // Filter templates by status
  const filteredTemplates = templates.filter((template) => {
    if (statusFilter === "all") return true;
    return template.status === statusFilter;
  });

  const handleCreateTemplate = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (data: { name: string }) => {
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
      const response = await client.api["form-templates"].post(data);

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to create form template",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Form template created successfully",
      });

      setIsCreateModalOpen(false);
      
      // Navigate to edit page for new template
      const newTemplate = response.data?.data;
      if (newTemplate?.id) {
        navigate(`/settings/form-templates/${newTemplate.id}/edit`);
      } else {
        revalidator.revalidate();
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast({
        title: "Error",
        description: "Failed to create form template",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
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
      const response = await client.api["form-templates"][templateId].delete();

      if (response.error) {
        toast({
          title: "Error",
          description: "Failed to delete form template",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Form template deleted successfully",
      });

      revalidator.revalidate();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: "Failed to delete form template",
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

      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Form Templates</h1>
          <p className="mt-2 text-sm text-gray-700">
            Create and manage form templates for supplier qualification and evaluation
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={handleCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Status Filter */}
      <div className="mt-6 flex items-center gap-4">
        <label
          htmlFor="status-filter"
          className="text-sm font-medium text-gray-700"
        >
          Filter by status:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | "draft" | "published" | "archived")
          }
          className="block rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
        >
          <option value="all">All Templates</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <div className="text-sm text-gray-500">
          {filteredTemplates.length}{" "}
          {filteredTemplates.length === 1 ? "template" : "templates"}
        </div>
      </div>

      {/* Templates Table */}
      <div className="mt-8">
        <FormTemplateTable
          templates={filteredTemplates}
          onDelete={handleDeleteTemplate}
          token={token}
        />
      </div>

      {/* Create Template Modal */}
      <CreateTemplateModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleCreateSubmit}
      />
    </div>
  );
}

