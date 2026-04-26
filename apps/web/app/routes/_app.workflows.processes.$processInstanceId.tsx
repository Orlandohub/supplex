/**
 * Workflow Engine Process Detail Page
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * Displays workflow process instance with steps, tasks, and comments
 */

import type {
  LoaderFunctionArgs,
  MetaFunction,
  ShouldRevalidateFunctionArgs,
} from "react-router";
import { data as json } from "react-router";
import {
  useLoaderData,
  useSearchParams,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { WorkflowProcessDetailPage } from "~/components/workflow-engine/WorkflowProcessDetailPage";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.process) {
    return [
      { title: "Workflow Not Found | Supplex" },
      {
        name: "description",
        content: "The requested workflow process could not be found.",
      },
    ];
  }
  return [
    {
      title: `Workflow Process - ${data.process.processType} | Supplex`,
    },
    {
      name: "description",
      content: `View workflow process ${data.process.processType}`,
    },
  ];
};

/**
 * Loader function to fetch workflow process details
 *
 * Fetches:
 * - Process instance with all metadata
 * - Step instances ordered by step_order
 * - Active tasks for current user
 * - Comment threads for the process
 */
export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;

  // Protect this route - require authentication
  const { session, user: supabaseUser, userRecord } = await requireAuth(args);

  // Get process ID from URL params
  const { processInstanceId } = params;
  if (!processInstanceId) {
    throw new Response("Process ID is required", { status: 400 });
  }

  // Create Eden Treaty client with auth token
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  try {
    // Fetch process details
    const processResponse = await (client.api.workflows.processes as any)[
      processInstanceId
    ].get();

    // Handle API errors
    if (processResponse.error) {
      const status = processResponse.status || 500;
      if (status === 403) {
        throw new Response("You do not have access to this workflow process", {
          status: 403,
        });
      }
      if (status === 404) {
        throw new Response("Workflow process not found", { status: 404 });
      }
      console.error("Process API Error:", processResponse.error);
      throw new Response(
        processResponse.error.message || "Failed to load process",
        { status }
      );
    }

    const data = processResponse.data;
    if (!data?.success || !data.data) {
      // Check if the body itself carries an authorization error (belt-and-suspenders)
      const bodyError = (data as any)?.error;
      if (
        typeof bodyError === "string" &&
        bodyError.toLowerCase().includes("access denied")
      ) {
        throw new Response(bodyError, { status: 403 });
      }
      throw new Response("Invalid API response", { status: 500 });
    }

    const steps = data.data.steps;

    // Form submissions are now included in the process API response,
    // already keyed by stepInstanceId — no extra HTTP calls needed.
    const formSubmissionsMap: Record<string, any> =
      (data.data as any).formSubmissions || {};

    // Build validation info from the enriched step data returned by the API
    const validationSteps = steps.map((step: any) => ({
      stepId: step.id,
      requiresValidation: step.requiresValidation ?? false,
    }));

    const documentProgress: Record<string, any> =
      (data.data as any).documentProgress || {};

    return json({
      process: data.data.process,
      steps: data.data.steps,
      tasks: data.data.tasks,
      comments: data.data.comments,
      formSubmissions: formSubmissionsMap,
      documentProgress,
      validationSteps,
      token,
      user: {
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        fullName:
          userRecord?.fullName ||
          userRecord?.full_name ||
          supabaseUser.email ||
          "",
        role: userRecord?.role || "",
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("Loader error:", error);
    throw new Response("Failed to load workflow process", { status: 500 });
  }
}

/**
 * Prevent revalidation on tab changes (URL search param changes)
 * Only revalidate on explicit actions
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
  formMethod,
}: ShouldRevalidateFunctionArgs) {
  // Revalidate on form submissions
  if (formMethod && formMethod !== "GET") {
    return true;
  }

  // Don't revalidate if only search params changed (tab navigation)
  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
  ) {
    return false;
  }

  return defaultShouldRevalidate;
}

/**
 * Main component
 */
export default function WorkflowProcessDetail() {
  const {
    process,
    steps,
    tasks,
    comments,
    formSubmissions,
    documentProgress,
    validationSteps,
    token,
    user,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  return (
    <WorkflowProcessDetailPage
      process={process}
      steps={steps}
      tasks={tasks}
      comments={comments}
      formSubmissions={formSubmissions}
      documentProgress={documentProgress}
      validationSteps={validationSteps}
      activeTab={activeTab}
      token={token}
      user={user}
    />
  );
}

/**
 * Error boundary for this route
 */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const is403 = error.status === 403;
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {is403 ? "Access Denied" : error.status}
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            {is403
              ? "You do not have permission to view this workflow process."
              : error.statusText}
          </p>
          {error.data && !is403 && (
            <p className="text-gray-500 mb-8">{error.data}</p>
          )}
          <a
            href="/workflows"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Workflows
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Unexpected Error
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Something went wrong while loading this workflow process.
        </p>
        <a
          href="/workflows"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Back to Workflows
        </a>
      </div>
    </div>
  );
}
