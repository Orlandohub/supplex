import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { WorkflowReviewPage } from "~/components/workflows/WorkflowReviewPage";
import { useEffect } from "react";
import { toast } from "sonner";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.workflow) {
    return [
      { title: "Workflow Review | Supplex" },
      {
        name: "description",
        content: "Review workflow details.",
      },
    ];
  }
  return [
    {
      title: `Review ${data.workflow.supplier.name} | Supplex`,
    },
    {
      name: "description",
      content: `Review and approve qualification workflow for ${data.workflow.supplier.name}`,
    },
  ];
};

/**
 * Loader function to fetch workflow review data
 * AC 3, 4, 5: Fetch workflow, supplier, documents, stage for review
 */
export async function loader(args: LoaderFunctionArgs) {
  const { params, request } = args;
  const { session } = await requireAuth(args);

  // Get workflow ID from URL params
  const { id } = params;
  if (!id) {
    throw new Response("Workflow ID is required", { status: 400 });
  }

  // Check for error query param (from redirect)
  const url = new URL(request.url);
  const error = url.searchParams.get("error");

  // Create Eden Treaty client with auth token
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Fetch review data
  try {
    const response = await client.api.workflows[id].review.get();

    // Handle API errors
    if (response.error) {
      // 403: Not assigned to this workflow
      if (response.status === 403) {
        return redirect("/tasks?error=not_assigned");
      }
      // 404: Workflow not found
      if (response.status === 404) {
        throw new Response("Workflow not found", { status: 404 });
      }
      throw new Response("Failed to load workflow review", { status: 500 });
    }

    const apiResponse = response.data as {
      success: boolean;
      data: {
        workflow: any;
        supplier: any;
        documents: any[];
        stage: any;
        initiator: {
          fullName: string;
          email: string;
        };
      };
    };

    // Fetch workflow history if Stage 3 (for history summary display)
    let workflowHistory = null;
    if (apiResponse.data.stage?.stageNumber === 3) {
      try {
        const historyResponse = await client.api.workflows[id].history.get();
        if (historyResponse.data && !historyResponse.error) {
          const historyData = historyResponse.data as {
            success: boolean;
            data: any;
          };
          workflowHistory = historyData.data;
        }
      } catch (historyError) {
        console.error("Failed to fetch workflow history:", historyError);
        // Continue without history - not critical for review
      }
    }

    return json({
      workflow: apiResponse.data.workflow,
      supplier: apiResponse.data.supplier,
      documents: apiResponse.data.documents,
      stage: apiResponse.data.stage,
      initiator: apiResponse.data.initiator,
      workflowHistory,
      error,
      token,
    });
  } catch (error) {
    console.error("Failed to fetch workflow review:", error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response("Failed to load workflow review", { status: 500 });
  }
}

export default function WorkflowReview() {
  const {
    workflow,
    supplier,
    documents,
    stage,
    initiator,
    workflowHistory,
    error,
    token,
  } = useLoaderData<typeof loader>();

  // Show error toast if redirected with error
  useEffect(() => {
    if (error === "not_assigned") {
      toast.error("You are not assigned to review this workflow");
    }
  }, [error]);

  return (
    <WorkflowReviewPage
      workflow={workflow}
      supplier={supplier}
      documents={documents}
      stage={stage}
      initiator={initiator}
      workflowHistory={workflowHistory}
      token={token}
    />
  );
}
