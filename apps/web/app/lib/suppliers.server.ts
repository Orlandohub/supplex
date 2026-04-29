/**
 * Server-side Supplier Utilities
 * Helper functions for supplier operations in loaders/actions
 */

import { createEdenTreatyClient } from "./api-client";

/**
 * Get supplier associated with a specific user ID
 * Used for supplier_user role to find their associated supplier
 *
 * @param userId - User ID to lookup
 * @param token - JWT authentication token
 * @returns Supplier info if found, null if not found
 */
export async function getSupplierForUser(
  userId: string,
  token: string
): Promise<{ id: string; name: string } | null> {
  try {
    const client = createEdenTreatyClient(token);

    const response = await client.api.suppliers["by-user"]({ userId }).get();

    // Handle 404 - no supplier found for this user
    if (response.error && response.status === 404) {
      return null;
    }

    // Handle other errors
    if (response.error) {
      console.error("Error fetching supplier for user:", response.error);
      throw new Error("Failed to fetch supplier information");
    }

    // Return supplier info
    if (response.data?.success && response.data.data) {
      return {
        id: response.data.data.id,
        name: response.data.data.name,
      };
    }

    return null;
  } catch (error) {
    console.error("Exception fetching supplier for user:", error);
    throw new Error("Failed to fetch supplier information");
  }
}
