import { useState } from "react";
import type {
  QualificationWorkflowWithSupplier,
  WorkflowDocumentWithDetails,
  RequiredDocumentItem,
  Document,
  WorkflowCompletionStatus,
} from "@supplex/types";
import { DocumentChecklist } from "./DocumentChecklist";
import { UploadedDocumentsList } from "./UploadedDocumentsList";
import { UploadWorkflowDocumentModal } from "./UploadWorkflowDocumentModal";
import { SubmitWorkflowModal } from "./SubmitWorkflowModal";
import { WorkflowTimelineWidget } from "./WorkflowTimelineWidget";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { UserRole } from "@supplex/types";

interface WorkflowDetailPageProps {
  workflow: QualificationWorkflowWithSupplier;
  workflowDocuments: WorkflowDocumentWithDetails[];
  supplierDocuments: Document[];
  completionStatus: WorkflowCompletionStatus;
  assignedReviewer?: { id: string; fullName: string; email: string } | null;
  token: string;
  userRole: string;
}

/**
 * Workflow Detail Page Component
 * Main page for displaying workflow details and document checklist (AC 1, 11, 12, 13)
 *
 * Features:
 * - Workflow header with supplier info, status, risk score
 * - Document checklist with progress bar
 * - Uploaded documents list
 * - Upload document modal
 * - Submit for Review button (disabled until all required docs uploaded)
 * - Mobile-responsive card-based layout
 * - Uses revalidator to refresh data
 */
export function WorkflowDetailPage({
  workflow,
  workflowDocuments,
  supplierDocuments,
  completionStatus,
  assignedReviewer,
  token,
  userRole,
}: WorkflowDetailPageProps) {
  const [selectedChecklistItem, setSelectedChecklistItem] =
    useState<RequiredDocumentItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Determine if workflow is in Draft status and can be edited
  const isDraft = workflow.status === "Draft";
  const isReadOnly = !isDraft;
  const canSubmit = isDraft && completionStatus.canSubmit;

  // Check if user can remove documents (Procurement Manager or Admin, and workflow is Draft)
  const canRemove =
    !isReadOnly &&
    [UserRole.PROCUREMENT_MANAGER, UserRole.ADMIN].includes(
      userRole as UserRole
    );

  const handleUploadClick = (checklistItem: RequiredDocumentItem) => {
    setSelectedChecklistItem(checklistItem);
    setIsUploadModalOpen(true);
  };

  const handleSubmitForReview = () => {
    setIsSubmitModalOpen(true);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Workflow Header */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {workflow.supplier.name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Qualification Workflow
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <WorkflowStatusBadge status={workflow.status} />
              {workflow.status === "Stage1" && workflow.currentStage === 1 && (
                <Badge variant="warning">Pending Review - Stage 1</Badge>
              )}
            </div>
          </div>

          {/* Read-only message */}
          {isReadOnly && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                This workflow is under review and cannot be edited.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm font-medium text-gray-500">Risk Score</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {workflow.riskScore
                  ? Number(workflow.riskScore).toFixed(2)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Initiated By</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {workflow.initiator?.fullName || "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">
                Initiated Date
              </p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {formatDate(workflow.initiatedDate)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Supplier Info */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Supplier Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Tax ID</p>
            <p className="text-sm text-gray-900 mt-1">
              {workflow.supplier.taxId}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Category</p>
            <p className="text-sm text-gray-900 mt-1">
              {workflow.supplier.category}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Contact Name</p>
            <p className="text-sm text-gray-900 mt-1">
              {workflow.supplier.contactName}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Contact Email</p>
            <p className="text-sm text-gray-900 mt-1">
              {workflow.supplier.contactEmail}
            </p>
          </div>
        </div>
      </Card>

      {/* Document Checklist */}
      <Card className="p-6">
        <DocumentChecklist
          checklistItems={workflow.checklistItems}
          workflowDocuments={workflowDocuments}
          workflowId={workflow.id}
          token={token}
          onUploadClick={handleUploadClick}
        />
      </Card>

      {/* Uploaded Documents List */}
      {workflowDocuments.some((wd) => wd.document !== null) && (
        <Card className="p-6">
          <UploadedDocumentsList
            workflowDocuments={workflowDocuments}
            workflowId={workflow.id}
            token={token}
            canRemove={canRemove}
          />
        </Card>
      )}

      {/* Workflow Timeline Widget (Placeholder for Story 2.10) */}
      <WorkflowTimelineWidget workflowId={workflow.id} token={token} />

      {/* Submit for Review Button */}
      {isDraft && (
        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Ready to submit?</h3>
              <p className="text-sm text-gray-500 mt-1">
                {canSubmit
                  ? "All required documents have been uploaded. You can now submit this workflow for Stage 1 approval."
                  : `Upload all required documents before submitting. Progress: ${completionStatus.uploadedCount} of ${completionStatus.requiredCount} documents (${completionStatus.completionPercentage}%)`}
              </p>
            </div>
            <Button
              size="lg"
              disabled={!canSubmit}
              onClick={handleSubmitForReview}
              className="w-full md:w-auto"
            >
              Submit for Review
            </Button>
          </div>
        </Card>
      )}

      {/* Upload Document Modal */}
      {selectedChecklistItem && (
        <UploadWorkflowDocumentModal
          open={isUploadModalOpen}
          onOpenChange={setIsUploadModalOpen}
          workflowId={workflow.id}
          checklistItem={selectedChecklistItem}
          supplierDocuments={supplierDocuments}
          token={token}
        />
      )}

      {/* Submit Workflow Modal */}
      <SubmitWorkflowModal
        open={isSubmitModalOpen}
        onOpenChange={setIsSubmitModalOpen}
        workflow={workflow}
        completionStatus={completionStatus}
        assignedReviewer={assignedReviewer}
        token={token}
      />
    </div>
  );
}
