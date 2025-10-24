/**
 * Document Checklist Templates Settings Page
 * Allows admins to manage document checklist templates for qualification workflows
 */

import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireRole } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { UserRole } from "@supplex/types";
import type { DocumentChecklist } from "@supplex/types";
import { ChecklistTable } from "~/components/checklists/ChecklistTable";
import { ChecklistDialog } from "~/components/checklists/ChecklistDialog";
import { DeleteConfirmDialog } from "~/components/checklists/DeleteConfirmDialog";
import { Button } from "~/components/ui/button";
import { Breadcrumb } from "~/components/ui/Breadcrumb";
import { Plus } from "lucide-react";

// Type for checklist data after Remix serialization (Dates become strings)
type SerializedDocumentChecklist = Omit<
  DocumentChecklist,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const meta: MetaFunction = () => {
  return [
    { title: "Qualification Checklists | Settings | Supplex" },
    {
      name: "description",
      content:
        "Manage document checklist templates for supplier qualification workflows.",
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;

  // Require Admin role for this route
  const { session } = await requireRole(request, [UserRole.ADMIN]);

  // Create Eden Treaty client with auth token
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Fetch checklist templates from API
  try {
    const response = await client.api.checklists.get();

    // Handle API errors
    if (response.error) {
      console.error("API Error:", response.error);
      throw new Response("Failed to load checklist templates", { status: 500 });
    }

    // Eden Treaty returns data wrapped in { success: true, data: { ... } }
    if (
      !response.data ||
      typeof response.data !== "object" ||
      !("data" in response.data)
    ) {
      throw new Response("Invalid API response format", { status: 500 });
    }

    const apiResponse = response.data as {
      success: boolean;
      data: {
        checklists: DocumentChecklist[];
      };
    };

    return json({
      checklists: apiResponse.data.checklists,
      token,
    });
  } catch (error) {
    console.error("Failed to fetch checklist templates:", error);
    throw new Response("Failed to load checklist templates", { status: 500 });
  }
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: {
  currentUrl: URL;
  nextUrl: URL;
  defaultShouldRevalidate: boolean;
}) {
  // Don't revalidate on URL param changes (e.g., modal open/close)
  if (currentUrl.pathname === nextUrl.pathname) {
    if (
      currentUrl.searchParams.toString() !== nextUrl.searchParams.toString()
    ) {
      return false;
    }
  }
  return defaultShouldRevalidate;
}

export default function ChecklistsSettingsPage() {
  const { checklists, token } = useLoaderData<typeof loader>() as {
    checklists: SerializedDocumentChecklist[];
    token: string;
  };

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedChecklist, setSelectedChecklist] =
    useState<SerializedDocumentChecklist | null>(null);

  const handleCreateClick = () => {
    setSelectedChecklist(null);
    setShowCreateDialog(true);
  };

  const handleEditClick = (checklist: SerializedDocumentChecklist) => {
    setSelectedChecklist(checklist);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (checklist: SerializedDocumentChecklist) => {
    setSelectedChecklist(checklist);
    setShowDeleteDialog(true);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Settings", href: "/settings" },
            {
              label: "Checklists",
              href: "/settings/checklists",
              isCurrentPage: true,
            },
          ]}
        />
      </div>

      {/* Header Section */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">
            Qualification Checklists
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage document checklist templates for supplier qualification
            workflows.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Checklist Table */}
      <div className="mt-8">
        <ChecklistTable
          checklists={checklists}
          onCreateClick={handleCreateClick}
          onEditClick={handleEditClick}
          onDeleteClick={handleDeleteClick}
        />
      </div>

      {/* Create Dialog */}
      <ChecklistDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        mode="create"
        token={token}
      />

      {/* Edit Dialog */}
      <ChecklistDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        mode="edit"
        checklist={selectedChecklist || undefined}
        token={token}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        checklist={selectedChecklist}
        token={token}
      />
    </div>
  );
}
