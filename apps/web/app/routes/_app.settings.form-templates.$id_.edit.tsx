/**
 * Form Template Edit Page
 * Allows admins to edit form templates, add sections and fields
 */

import { data as json, redirect, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import { ArrowLeft } from "lucide-react";
import {
  FormTemplateBuilder,
  type FormTemplateBuilderTemplate,
} from "~/components/form-templates/FormTemplateBuilder";

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
    // Fetch template with all versions, sections, and fields
    const templateResponse = await (client.api["form-templates"] as any)[
      id
    ].get();

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

    const template = templateResponse.data
      ?.data as unknown as FormTemplateBuilderTemplate;

    return json({
      template,
      token,
    });
  } catch (error) {
    console.error("Error fetching form template:", error);
    throw new Response("Failed to load template", { status: 500 });
  }
}

export default function FormTemplateEditPage() {
  const { template, token } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button and Header */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/settings/form-templates")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>

      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">
            {template.name}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Edit form template structure and configuration
          </p>
        </div>
      </div>

      {/* Form Builder */}
      <div className="mt-8">
        <FormTemplateBuilder template={template} token={token} />
      </div>
    </div>
  );
}
