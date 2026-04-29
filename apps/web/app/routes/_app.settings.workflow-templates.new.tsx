/**
 * New Workflow Template Page
 * Allows admins to create a new workflow template
 */

import {
  data as json,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "react-router";
import { Form, useActionData, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useState } from "react";

export async function loader(args: LoaderFunctionArgs) {
  // Require authentication
  const { userRecord } = await requireAuth(args);

  // Server-side permission check - Admin only
  if (userRecord.role !== UserRole.ADMIN) {
    return redirect("/");
  }

  return json({});
}

export async function action(args: ActionFunctionArgs) {
  const { request } = args;

  // Require authentication
  const { session } = await requireAuth(args);

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const processType = formData.get("processType") as string;

  const client = createEdenTreatyClient(token);

  try {
    // TODO(SUP-12): the form collects `processType` but the current API
    // body schema (`apps/api/src/routes/workflow-templates/create.ts`)
    // only accepts `{ name, description?, active? }`, so the field is
    // silently dropped today. We omit it from the request body to match
    // the wire contract; SUP-12 should either widen the API schema to
    // persist it or drop the field from the form. Reference here so the
    // unused local does not get inlined away.
    void processType;
    const response = await client.api["workflow-templates"].post({
      name,
      description: description || undefined,
    });

    if (response.error) {
      return json(
        { error: "Failed to create workflow template" },
        { status: 400 }
      );
    }

    const templatePayload = response.data as {
      success: boolean;
      data?: { id?: string };
    } | null;
    const template = templatePayload?.data;
    if (!template?.id) {
      return json({ error: "Invalid response from server" }, { status: 500 });
    }

    // Redirect to edit page
    return redirect(`/settings/workflow-templates/${template.id}/edit`);
  } catch (error) {
    console.error("Error creating workflow template:", error);
    return json(
      { error: "Failed to create workflow template" },
      { status: 500 }
    );
  }
}

export default function NewWorkflowTemplatePage() {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [processType, setProcessType] = useState("");

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/settings/workflow-templates")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            New Workflow Template
          </h1>
          <p className="text-muted-foreground mt-1">
            Create a new workflow template for your organization
          </p>
        </div>
      </div>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>
            Provide basic information about your workflow template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Supplier Qualification v2"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the purpose of this workflow template"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="processType">Process Type *</Label>
              <Select
                name="processType"
                value={processType || undefined}
                onValueChange={setProcessType}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose process type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier_qualification">
                    Supplier Qualification
                  </SelectItem>
                  <SelectItem value="sourcing">Sourcing</SelectItem>
                  <SelectItem value="product_lifecycle">
                    Product Lifecycle
                  </SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {actionData?.error && (
              <div className="text-sm text-destructive">{actionData.error}</div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/settings/workflow-templates")}
              >
                Cancel
              </Button>
              <Button type="submit">Create Template</Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
