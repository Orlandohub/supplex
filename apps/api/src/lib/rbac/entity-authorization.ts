/**
 * Entity-Level Authorization Helpers
 * Story 2.2.20 — Workflow Engine Security
 *
 * These helpers enforce within-tenant entity-level access control
 * (e.g. supplier_user can only access their own supplier's data).
 */

import { eq, and, isNull, or } from "drizzle-orm";
import {
  suppliers,
  taskInstance,
  processInstance,
  stepInstance,
} from "@supplex/db";
import type {
  DbOrTx,
  SelectProcessInstance,
  SelectDocument,
} from "@supplex/db";
import type { AuthContext } from "./middleware";
import { UserRole } from "@supplex/types";

/**
 * Returns the supplier linked to a supplier_user, or null if no link exists.
 */
export async function getSupplierForUser(
  userId: string,
  tenantId: string,
  db: DbOrTx
): Promise<{ id: string } | null> {
  const result = await db.query.suppliers.findFirst({
    where: and(
      eq(suppliers.supplierUserId, userId),
      eq(suppliers.tenantId, tenantId),
      isNull(suppliers.deletedAt)
    ),
    columns: { id: true },
  });
  return result ?? null;
}

/**
 * Checks whether the given user is allowed to access the specified process.
 * Internal roles always pass. Supplier users must own the process entity.
 */
export async function verifyProcessAccess(
  user: AuthContext["user"],
  process: Pick<SelectProcessInstance, "entityType" | "entityId">,
  db: DbOrTx
): Promise<{ allowed: boolean; reason?: string }> {
  if (user.role !== UserRole.SUPPLIER_USER) {
    return { allowed: true };
  }

  const supplier = await getSupplierForUser(user.id, user.tenantId, db);
  if (!supplier) {
    return {
      allowed: false,
      reason: "Supplier user is not associated with a supplier",
    };
  }

  if (process.entityType !== "supplier" || process.entityId !== supplier.id) {
    return {
      allowed: false,
      reason: "Access denied: process does not belong to your supplier",
    };
  }

  return { allowed: true };
}

/**
 * Checks whether the given user is allowed to access the specified document.
 * Internal roles always pass. Supplier users must own the document's supplier.
 */
export async function verifyDocumentAccess(
  user: AuthContext["user"],
  document: Pick<SelectDocument, "supplierId">,
  db: DbOrTx
): Promise<{ allowed: boolean; reason?: string }> {
  if (user.role !== UserRole.SUPPLIER_USER) {
    return { allowed: true };
  }

  const supplier = await getSupplierForUser(user.id, user.tenantId, db);
  if (!supplier) {
    return {
      allowed: false,
      reason: "Supplier user is not associated with a supplier",
    };
  }

  if (document.supplierId !== supplier.id) {
    return {
      allowed: false,
      reason: "Access denied: document does not belong to your supplier",
    };
  }

  return { allowed: true };
}

/**
 * Checks whether the user has a pending task of the required type(s)
 * for the given step instance.
 */
export async function verifyTaskAssignment(
  user: AuthContext["user"],
  stepInstanceId: string,
  requiredTaskTypes: string[],
  db: DbOrTx
): Promise<{ allowed: false } | { allowed: true; taskId: string }> {
  const matchingTasks = await db
    .select({ id: taskInstance.id, taskType: taskInstance.taskType })
    .from(taskInstance)
    .where(
      and(
        eq(taskInstance.stepInstanceId, stepInstanceId),
        eq(taskInstance.tenantId, user.tenantId),
        eq(taskInstance.status, "pending"),
        or(
          eq(taskInstance.assigneeUserId, user.id),
          and(
            eq(taskInstance.assigneeType, "role"),
            eq(taskInstance.assigneeRole, user.role),
            isNull(taskInstance.assigneeUserId)
          )
        )
      )
    );

  const task = matchingTasks.find((t) =>
    requiredTaskTypes.includes(t.taskType)
  );

  if (!task) {
    return { allowed: false };
  }

  return { allowed: true, taskId: task.id };
}

/**
 * Given a step instance ID, loads the parent process and verifies
 * supplier-user access. Convenience wrapper for routes that start from a step.
 */
export async function verifyStepProcessAccess(
  user: AuthContext["user"],
  stepInstanceId: string,
  db: DbOrTx
): Promise<{ allowed: boolean; reason?: string }> {
  if (user.role !== UserRole.SUPPLIER_USER) {
    return { allowed: true };
  }

  const [step] = await db
    .select({ processInstanceId: stepInstance.processInstanceId })
    .from(stepInstance)
    .where(
      and(
        eq(stepInstance.id, stepInstanceId),
        eq(stepInstance.tenantId, user.tenantId)
      )
    );

  if (!step) {
    return { allowed: false, reason: "Step not found" };
  }

  const [process] = await db
    .select({
      entityType: processInstance.entityType,
      entityId: processInstance.entityId,
    })
    .from(processInstance)
    .where(eq(processInstance.id, step.processInstanceId));

  if (!process) {
    return { allowed: false, reason: "Process not found" };
  }

  return verifyProcessAccess(user, process, db);
}
