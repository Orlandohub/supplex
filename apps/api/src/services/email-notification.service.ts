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
