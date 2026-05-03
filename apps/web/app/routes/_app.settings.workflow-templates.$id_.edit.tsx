/**
 * Workflow Template Edit Page
 * Allows admins to edit workflow templates, manage versions and steps
 */

import { data as json, redirect, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import { ArrowLeft } from "lucide-react";
import {
  WorkflowTemplateEditor,
  type WorkflowTemplate as WorkflowTemplateProp,
  type User as WorkflowUserProp,
  type WorkflowTypeOption,
} from "~/components/workflow-builder/WorkflowTemplateEditor";

/**
 * Loader-shape: the API returns a richer template (with versions, steps),
 * but the editor consumes only the metadata fields. Reflect the runtime
 * (post-serialization) shape with `string` dates.
 */
type LoaderTemplate = WorkflowTemplateProp & {
  versions: Array<{
    id: string;
    version: number;
    status: string;
    isPublished: boolean;
    createdAt: string;
  }>;
};

export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;

  // Require authentication
  const { userRecord, session } = await requireAuth(args);

  // Server-side permission check - Admin only
  if (userRecord.role !== UserRole.ADMIN) {
    return redirect("/");
  }

  // Get template ID from URL params
  const { id } = params;
  if (!id) {
    throw new Response("Template ID is required", { status: 400 });
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Create Eden Treaty client
  const client = createEdenTreatyClient(token);

  try {
    const templateResponse = await client.api["workflow-templates"]({
      templateId: id,
    }).get();

    if (templateResponse.error) {
      const status = templateResponse.status || 500;
      if (status === 404) {
        throw new Response("Template not found", { status: 404 });
      }
      if (status === 403) {
        throw new Response("Access forbidden", { status: 403 });
      }
      throw new Response("Failed to load template", { status });
    }

    // Trust-boundary cast: Treaty types `data.data` with `Date` fields,
    // but Remix/React-Router JSON-encodes them to ISO strings before the
    // consumer. Asserting via `unknown` mirrors the
    // `_app.suppliers.$id_.edit.tsx` pattern.
    const templatePayload = templateResponse.data as unknown as {
      success: boolean;
      data: LoaderTemplate;
    } | null;
    const template = templatePayload?.data;
    if (!template) {
      throw new Response("Template not found", { status: 404 });
    }

    // Fetch users and workflow types in parallel
    const [usersResponse, workflowTypesResponse] = await Promise.all([
      client.api.users.get(),
      client.api.admin["workflow-types"].get(),
    ]);

    // Map the API user shape (`fullName`) to the editor's prop shape (`name`).
    const users: WorkflowUserProp[] = (
      usersResponse.data?.data?.users ?? []
    ).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.fullName,
      role: u.role,
    }));
    const workflowTypesPayload = workflowTypesResponse.data as {
      success: boolean;
      data: WorkflowTypeOption[];
    } | null;
    const workflowTypes: WorkflowTypeOption[] =
      workflowTypesPayload?.data || [];

    return json({
      template,
      users,
      workflowTypes,
      token,
    });
  } catch (error) {
    console.error("Error fetching workflow template:", error);
    throw new Response("Failed to load template", { status: 500 });
  }
}

// Prevent revalidation on URL state changes
export function shouldRevalidate() {
  return false;
}

export default function WorkflowTemplateEditPage() {
  const { template, users, workflowTypes, token } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/settings/workflow-templates")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {template.name}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Configure workflow steps, approvers, and forms
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workflow Template Editor */}
        <WorkflowTemplateEditor
          template={template}
          users={users}
          workflowTypes={workflowTypes}
          token={token}
        />
      </div>
    </div>
  );
}
