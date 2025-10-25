/**
 * Email Notification Service (Stub for Story 2.8)
 * MVP placeholder - logs emails to console instead of sending
 * Future Story 2.8 will implement: Resend.com integration, email templates, BullMQ job queue
 */

export interface WorkflowSubmittedEmailData {
  workflowId: string;
  reviewerId: string;
  reviewerEmail: string;
  initiatorName: string;
  supplierName: string;
  riskScore: string;
  workflowLink: string;
}

/**
 * Send workflow submitted email notification
 * @param data - Email notification data
 * @returns Promise<void>
 */
export async function sendWorkflowSubmittedEmail(
  data: WorkflowSubmittedEmailData
): Promise<void> {
  // MVP: Log to console instead of sending actual email
  // eslint-disable-next-line no-console
  console.log("[EMAIL STUB] Workflow Submitted Email", {
    to: data.reviewerEmail,
    subject: `Action Required: ${data.supplierName} Qualification`,
    workflow_id: data.workflowId,
    supplier: data.supplierName,
    initiator: data.initiatorName,
    risk_score: data.riskScore,
    link: data.workflowLink,
    timestamp: new Date().toISOString(),
  });

  // No-op for MVP
  return Promise.resolve();
}

export interface StageApprovedEmailData {
  workflowId: string;
  initiatorEmail: string;
  initiatorName: string;
  supplierName: string;
  reviewerName: string;
  stageNumber: number;
  nextStage: string;
  workflowLink: string;
}

/**
 * Send stage approved email notification
 * Notifies workflow initiator that a stage has been approved
 * @param data - Email notification data
 * @returns Promise<void>
 */
export async function sendStageApprovedEmail(
  data: StageApprovedEmailData
): Promise<void> {
  // MVP: Log to console instead of sending actual email
  // eslint-disable-next-line no-console
  console.log("[EMAIL STUB] Stage Approved Email", {
    to: data.initiatorEmail,
    subject: `${data.supplierName} Qualification - Stage ${data.stageNumber} Approved`,
    workflow_id: data.workflowId,
    supplier: data.supplierName,
    reviewer: data.reviewerName,
    stage_number: data.stageNumber,
    next_stage: data.nextStage,
    link: data.workflowLink,
    timestamp: new Date().toISOString(),
  });

  // No-op for MVP
  return Promise.resolve();
}

export interface StageRejectedEmailData {
  workflowId: string;
  initiatorEmail: string;
  initiatorName: string;
  supplierName: string;
  reviewerName: string;
  stageNumber: number;
  rejectionComments: string;
  workflowLink: string;
}

/**
 * Send stage rejected email notification
 * Notifies workflow initiator that a stage has been rejected with feedback
 * @param data - Email notification data
 * @returns Promise<void>
 */
export async function sendStageRejectedEmail(
  data: StageRejectedEmailData
): Promise<void> {
  // MVP: Log to console instead of sending actual email
  // eslint-disable-next-line no-console
  console.log("[EMAIL STUB] Stage Rejected Email", {
    to: data.initiatorEmail,
    subject: `${data.supplierName} Qualification - Changes Requested`,
    workflow_id: data.workflowId,
    supplier: data.supplierName,
    reviewer: data.reviewerName,
    stage_number: data.stageNumber,
    rejection_comments: data.rejectionComments,
    link: data.workflowLink,
    timestamp: new Date().toISOString(),
  });

  // No-op for MVP
  return Promise.resolve();
}

export interface SupplierApprovalCongratulationsData {
  supplierName: string;
  supplierEmail: string;
  workflowId: string;
}

/**
 * Send supplier approval congratulations email
 * Notifies supplier of final qualification approval (Stage 3 completion)
 * Only sent if tenant.settings.enableSupplierApprovalEmails === true
 * @param data - Email notification data
 * @returns Promise<void>
 */
export async function sendSupplierApprovalCongratulations(
  data: SupplierApprovalCongratulationsData
): Promise<void> {
  // MVP: Log to console instead of sending actual email
  // eslint-disable-next-line no-console
  console.log("[EMAIL STUB] Supplier Approval Congratulations Email", {
    to: data.supplierEmail,
    subject: `Congratulations! Your qualification has been approved`,
    supplier: data.supplierName,
    workflow_id: data.workflowId,
    timestamp: new Date().toISOString(),
  });

  // No-op for MVP
  // TODO Story 2.8: Implement with Resend.com
  // TODO Story 2.8: Check tenant.settings.enableSupplierApprovalEmails before sending
  return Promise.resolve();
}
