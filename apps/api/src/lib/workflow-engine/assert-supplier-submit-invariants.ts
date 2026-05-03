/**
 * Supplier form/step submit invariant checks inside the writable transaction.
 *
 * Ensures request success/failure aligns with DB state observed in tx:
 * callers must invoke this still inside db.transaction(...), never after commit.
 */

import type { DbOrTx } from "@supplex/db";
import { formSubmission, stepInstance } from "@supplex/db";
import type { CompleteStepResult } from "./complete-step";
import type { Logger } from "pino";
import { and, eq, isNull } from "drizzle-orm";

export const SUPPLIER_SUBMIT_INVARIANT_ERROR_PREFIX =
  "SUPPLIER_SUBMIT_INVARIANT_FAILED";

export const VALID_SUPPLIER_SUBMIT_TERMINAL_STEP_STATUSES = [
  "completed",
  "awaiting_validation",
] as const;

export type ValidSupplierSubmitTerminalStepStatus =
  (typeof VALID_SUPPLIER_SUBMIT_TERMINAL_STEP_STATUSES)[number];

export function expectedStepStatusAfterSupplierComplete(
  stepResult: CompleteStepResult
): ValidSupplierSubmitTerminalStepStatus {
  return stepResult.data?.awaitingValidation
    ? "awaiting_validation"
    : "completed";
}

export interface SupplierSubmitInvariantLogFields {
  event: "supplier_submit_invariant_failed";
  correlationId?: string | undefined;
  tenantId: string;
  submissionId?: string | undefined;
  stepInstanceId: string;
  actorUserId?: string | undefined;
  preFormStatus?: string | null | undefined;
  preStepStatus?: string | null | undefined;
  expectedStepStatus: ValidSupplierSubmitTerminalStepStatus;
  requiresValidationFlag: boolean;
  actualStepStatus?: string | undefined;
  actualFormStatus?: string | undefined;
  stepRowMissing?: boolean | undefined;
  formRowMissing?: boolean | undefined;
  submissionIdUsedForInvariantCheck?: string | undefined;
}

export async function assertSupplierSubmitInvariantInTx(
  tx: DbOrTx,
  args: {
    tenantId: string;
    stepInstanceId: string;
    stepResult: CompleteStepResult;
    submissionId?: string;
    correlationId?: string;
    actorUserId?: string;
    preFormStatus?: string | null;
    preStepStatus?: string | null;
    log?: Logger;
  }
): Promise<void> {
  const expectedStepStatus = expectedStepStatusAfterSupplierComplete(
    args.stepResult
  );
  const requiresValidationFlag = !!args.stepResult.data?.awaitingValidation;

  const [stepRow] = await tx
    .select({ status: stepInstance.status })
    .from(stepInstance)
    .where(
      and(
        eq(stepInstance.id, args.stepInstanceId),
        eq(stepInstance.tenantId, args.tenantId)
      )
    )
    .limit(1);

  let formRow:
    | { status: (typeof formSubmission.$inferSelect)["status"] }
    | undefined;

  if (args.submissionId !== undefined) {
    const [row] = await tx
      .select({ status: formSubmission.status })
      .from(formSubmission)
      .where(
        and(
          eq(formSubmission.id, args.submissionId),
          eq(formSubmission.tenantId, args.tenantId),
          isNull(formSubmission.deletedAt)
        )
      )
      .limit(1);
    formRow = row;
  }

  const failLog = (
    extra: Omit<
      SupplierSubmitInvariantLogFields,
      | "event"
      | "tenantId"
      | "stepInstanceId"
      | "expectedStepStatus"
      | "requiresValidationFlag"
    > &
      Partial<
        Pick<
          SupplierSubmitInvariantLogFields,
          "actualStepStatus" | "actualFormStatus"
        >
      >
  ) =>
    ({
      ...extra,
      event: "supplier_submit_invariant_failed" as const,
      tenantId: args.tenantId,
      submissionId: args.submissionId,
      submissionIdUsedForInvariantCheck: args.submissionId,
      stepInstanceId: args.stepInstanceId,
      expectedStepStatus: expectedStepStatus,
      requiresValidationFlag,
    }) satisfies SupplierSubmitInvariantLogFields;

  let ok = Boolean(stepRow);
  const actualStepStatus = stepRow?.status;
  const actualFormStatus = formRow?.status;

  if (args.submissionId !== undefined) {
    ok = ok && formRow !== undefined && formRow.status === "submitted";
  }

  if (!stepRow || stepRow.status !== expectedStepStatus) {
    ok = false;
  }

  if (ok) {
    return;
  }

  args.log?.error(
    failLog({
      correlationId: args.correlationId,
      actorUserId: args.actorUserId,
      preFormStatus: args.preFormStatus,
      preStepStatus: args.preStepStatus,
      actualStepStatus,
      actualFormStatus,
      stepRowMissing: !stepRow,
      formRowMissing:
        args.submissionId !== undefined ? formRow === undefined : undefined,
    }),
    "supplier submit invariant failed — rolling back transaction"
  );

  const detailParts: string[] = [];
  detailParts.push(
    `step expected=${expectedStepStatus} actual=${actualStepStatus ?? "missing"}`
  );
  if (args.submissionId !== undefined) {
    detailParts.push(
      `form expected=submitted actual=${actualFormStatus ?? "missing"}`
    );
  }

  throw new Error(
    `${SUPPLIER_SUBMIT_INVARIANT_ERROR_PREFIX}: ${detailParts.join("; ")}`
  );
}
