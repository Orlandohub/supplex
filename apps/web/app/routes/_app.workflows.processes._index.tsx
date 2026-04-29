/**
 * Workflow Processes List Page
 * Story: 2.2.8 - Workflow Execution Engine
 *
 * Displays list of all workflow process instances
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data as json } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { errorBody } from "~/lib/api-helpers";
import {
  WorkflowProcessList,
  type ProcessInstance,
} from "~/components/workflow-engine/WorkflowProcessList";
import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => {
  return [
    { title: "Workflow Processes | Supplex" },
    {
      name: "description",
      content: "View and manage workflow processes",
    },
  ];
};

/**
 * Loader function to fetch all workflow processes
 */
export async function loader(args: LoaderFunctionArgs) {
  const { session, user } = await requireAuth(args);

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  try {
    // Fetch all processes
    const response = await client.api.workflows.processes.get();

    if (response.error) {
      const status = response.status || 500;
      console.error("Processes API Error:", response.error);
      const errBody = errorBody(response.error);
      throw new Response(errBody?.error.message || "Failed to load processes", {
        status,
      });
    }

    const data = response.data;
    if (!data?.success || !data.data) {
      throw new Response("Invalid API response", { status: 500 });
    }

    // Trust-boundary cast: Treaty types `Date` fields as `Date`, but Remix
    // serializes the loader payload to JSON, so the client receives `string`s.
    // The component's `ProcessInstance` already models the wire shape.
    const processes = data.data.processes as unknown as ProcessInstance[];

    return json({
      processes,
      token,
      user,
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    console.error("Loader error:", error);
    throw new Response("Failed to load workflow processes", { status: 500 });
  }
}

/**
 * Main component
 */
export default function WorkflowProcessesIndex() {
  const { processes, token, user } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Workflow Processes
          </h1>
          <p className="text-gray-600 mt-1">
            View and manage active workflow processes
          </p>
        </div>
        <Button asChild>
          <Link to="/settings/workflow-templates">View Templates</Link>
        </Button>
      </div>

      {/* Process List */}
      <WorkflowProcessList processes={processes} token={token} user={user} />
    </div>
  );
}
