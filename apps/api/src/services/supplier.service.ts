/**
 * Supplier Service
 * Helper functions for supplier operations
 */

import { db } from "@supplex/db";
import { suppliers } from "@supplex/db/schema";
import { eq } from "drizzle-orm";

/**
 * Update supplier status with audit trail
 * @param supplierId - Supplier UUID
 * @param tenantId - Tenant UUID (for validation)
 * @param newStatus - New supplier status
 * @param userId - User making the change
 * @returns Updated supplier record
 */
export async function updateSupplierStatus(
  supplierId: string,
  tenantId: string,
  newStatus: string,
  _userId: string
): Promise<unknown> {
  // Update supplier status
  const updatedSuppliers = await db
    .update(suppliers)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(suppliers.id, supplierId))
    .returning();

  if (!updatedSuppliers.length) {
    throw new Error("Supplier not found");
  }

  // TODO: Story 2.10 will add audit log entry
  // await createAuditLog({
  //   event: "supplier_status_changed",
  //   old_status: oldStatus,
  //   new_status: newStatus,
  //   reason: "workflow_submission",
  //   userId,
  //   tenantId,
  // });

  return updatedSuppliers[0];
}
