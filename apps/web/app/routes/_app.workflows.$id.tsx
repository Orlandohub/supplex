import type {
  LoaderFunctionArgs,
  MetaFunction,
  ShouldRevalidateFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  Link,
} from "@remix-run/react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import type {
  QualificationWorkflowWithSupplier,
  WorkflowDocumentWithDetails,
  Document,
  WorkflowCompletionStatus,
} from "@supplex/types";
import { WorkflowDetailPage } from "~/components/workflows/WorkflowDetailPage";
import { Breadcrumb } from "~/components/ui/Breadcrumb";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.workflow) {
    return [
      { title: "Workflow Not Found | Supplex" },
      {
        name: "description",
        content: "The requested workflow could not be found.",
      },
    ];
  }
  return [
    {
      title: `Qualification Workflow - ${data.workflow.supplier.name} | Supplex`,
    },
    {
      name: "description",
      content: `View qualification workflow for supplier ${data.workflow.supplier.name}`,
    },
  ];
};

/**
 * Loader function to fetch workflow details
 * Handles authentication and API calls (AC 1, 8, 13)
 *
 * Fetches:
 * - Workflow with supplier info and snapshotted checklist
 * - Workflow documents with full metadata
 * - Supplier's existing documents for linking option
 */
export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;

  // Protect this route - require authentication
  const { session, user } = await requireAuth(args);

  // Get workflow ID from URL params
  const { id } = params;
  if (!id) {
    throw new Response("Workflow ID is required", { status: 400 });
  }

  // Create Eden Treaty client with auth token
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Fetch workflow, documents, completion status, and assigned reviewer in parallel
  try {
    const [
      workflowResponse,
      documentsResponse,
      completionStatusResponse,
      assignedReviewerResponse,
    ] = await Promise.all([
      client.api.workflows[id].get(),
      client.api.workflows[id].documents.get(),
      client.api.workflows[id]["completion-status"].get(),
      client.api.workflows[id]["assigned-reviewer"].get(),
    ]);

    // Handle workflow API errors
    if (workflowResponse.error) {
      const status = workflowResponse.status || 500;
      if (status === 404) {
        throw new Response("Workflow not found", { status: 404 });
      }
      console.error("Workflow API Error:", workflowResponse.error);
      throw new Response(
        workflowResponse.error.message || "Failed to load workflow",
        { status }
      );
    }

    // Handle documents API errors
    if (documentsResponse.error) {
      console.error("Workflow Documents API Error:", documentsResponse.error);
      // Don't fail the whole page if documents fail to load
    }

    const workflow = workflowResponse.data.workflow;

    // Fetch supplier's existing documents for the "Link Existing" option
    let supplierDocuments: Document[] = [];
    if (workflow.supplier?.id) {
      try {
        const supplierDocsResponse =
          await client.api.suppliers[workflow.supplier.id].documents.get();

        if (!supplierDocsResponse.error && supplierDocsResponse.data) {
          supplierDocuments = supplierDocsResponse.data.documents || [];
        }
      } catch (error) {
        console.error("Failed to fetch supplier documents:", error);
        // Continue without supplier documents
      }
    }

    return json({
      workflow: workflow as QualificationWorkflowWithSupplier,
      workflowDocuments:
        (documentsResponse.data
          ?.workflowDocuments as WorkflowDocumentWithDetails[]) || [],
      supplierDocuments,
      completionStatus: (completionStatusResponse.data || {
        canSubmit: false,
        requiredCount: 0,
        uploadedCount: 0,
        completionPercentage: 0,
        missingDocuments: [],
      }) as WorkflowCompletionStatus,
      assignedReviewer: assignedReviewerResponse.data?.reviewer || null,
      token,
      userRole: user.role,
    });
  } catch (error) {
    console.error("Workflow loader error:", error);

    if (error instanceof Response) {
      throw error;
    }

    throw new Response("Failed to load workflow details", { status: 500 });
  }
}

/**
 * shouldRevalidate configuration
 * Prevents unnecessary revalidation on URL param changes (AC 1)
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // Don't revalidate on search param changes only
  if (currentUrl.pathname === nextUrl.pathname) {
    if (
      currentUrl.searchParams.toString() !== nextUrl.searchParams.toString()
    ) {
      return false;
    }
  }

  return defaultShouldRevalidate;
}

/**
 * Workflow Detail Route Component
 * Displays workflow details with document checklist and upload functionality
 */
export default function WorkflowDetailRoute() {
  const {
    workflow,
    workflowDocuments,
    supplierDocuments,
    completionStatus,
    assignedReviewer,
    token,
    userRole,
  } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b px-4 py-3">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Suppliers", href: "/suppliers" },
            {
              label: workflow.supplier.name,
              href: `/suppliers/${workflow.supplierId}`,
            },
            { label: "Qualification Workflow", href: "#" },
          ]}
        />
      </div>

      {/* Main Content */}
      <WorkflowDetailPage
        workflow={workflow}
        workflowDocuments={workflowDocuments}
        supplierDocuments={supplierDocuments}
        completionStatus={completionStatus}
        assignedReviewer={assignedReviewer}
        token={token}
        userRole={userRole}
      />
    </div>
  );
}

/**
 * Error Boundary
 * Handles errors and displays appropriate messages
 */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {error.status}
          </h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            {error.status === 404 ? "Workflow Not Found" : "Error"}
          </h2>
          <p className="text-gray-600 mb-6">
            {error.statusText || error.data || "Something went wrong"}
          </p>
          <Link
            to="/suppliers"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Suppliers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-2">Error</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Unexpected Error
        </h2>
        <p className="text-gray-600 mb-6">
          An unexpected error occurred while loading the workflow.
        </p>
        <Link
          to="/suppliers"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Suppliers
        </Link>
      </div>
    </div>
  );
}
