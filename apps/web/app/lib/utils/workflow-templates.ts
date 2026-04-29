/**
 * Workflow Template Utilities
 * Story 2.2.9 - Supplier Workflow Integration
 */

import type {
  createEdenTreatyClient,
  createClientEdenTreatyClient,
} from "~/lib/api-client";

type TreatyClient =
  | ReturnType<typeof createEdenTreatyClient>
  | ReturnType<typeof createClientEdenTreatyClient>;

/**
 * Fetch Active Published Workflow Templates
 * Only templates with active=true AND status='published' should appear in dropdowns
 * for workflow instantiation
 *
 * @param client - Eden Treaty API client
 * @returns Promise with active published templates
 */
export async function fetchActivePublishedTemplates(client: TreatyClient) {
  const response = await client.api["workflow-templates"].get({
    query: {
      status: "published",
      active: true,
      limit: 100,
      offset: 0,
    },
  });

  if (response.error) {
    throw new Error("Failed to fetch active published workflow templates");
  }

  return response.data?.data || [];
}

/**
 * Check if a workflow template can be instantiated
 * Only active AND published templates can be instantiated
 */
export function canInstantiateTemplate(template: {
  active: boolean;
  status: string;
}): boolean {
  return template.active === true && template.status === "published";
}
