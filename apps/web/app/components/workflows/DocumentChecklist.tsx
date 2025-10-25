import type {
  RequiredDocumentItem,
  WorkflowDocumentWithDetails,
} from "@supplex/types";
import { ChecklistStatusBadge } from "./ChecklistStatusBadge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Upload, Eye } from "lucide-react";
import { ChecklistItemStatus as StatusEnum } from "@supplex/types";

interface DocumentChecklistProps {
  checklistItems: RequiredDocumentItem[];
  workflowDocuments: WorkflowDocumentWithDetails[];
  workflowId: string;
  token: string;
  onUploadClick: (checklistItem: RequiredDocumentItem) => void;
}

/**
 * Document Checklist Component
 * Displays checklist items with status indicators and upload buttons (AC 1, 2, 3, 11)
 *
 * Features:
 * - Shows document name, description, and Required badge
 * - Color-coded status indicators (Pending/Uploaded/Approved/Rejected)
 * - Upload button for Pending or Rejected items
 * - View/Remove buttons for uploaded documents
 * - Completion percentage display
 * - Responsive: Table on desktop, Cards on mobile
 */
export function DocumentChecklist({
  checklistItems,
  workflowDocuments,
  _workflowId,
  _token,
  onUploadClick,
}: DocumentChecklistProps) {
  // Map checklist items to their corresponding workflow documents
  const getWorkflowDocForItem = (itemId: string | undefined) => {
    if (!itemId) return null;
    return workflowDocuments.find((wd) => wd.checklistItemId === itemId);
  };

  // Calculate completion percentage
  const requiredItems = checklistItems.filter((item) => item.required);
  const uploadedCount = requiredItems.filter((item) => {
    const workflowDoc = getWorkflowDocForItem(item.id);
    return (
      workflowDoc &&
      (workflowDoc.status === StatusEnum.UPLOADED ||
        workflowDoc.status === StatusEnum.APPROVED)
    );
  }).length;

  const completionPercentage =
    requiredItems.length > 0
      ? Math.round((uploadedCount / requiredItems.length) * 100)
      : 0;

  const renderItemActions = (item: RequiredDocumentItem) => {
    const workflowDoc = getWorkflowDocForItem(item.id);
    const status = workflowDoc?.status || StatusEnum.PENDING;

    // Show Upload button if Pending or Rejected
    if (status === StatusEnum.PENDING || status === StatusEnum.REJECTED) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onUploadClick(item)}
          className="gap-1"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      );
    }

    // Show View/Remove buttons if document uploaded
    if (workflowDoc?.document) {
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // TODO: Implement view document (download)
            }}
            className="gap-1"
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* Completion Progress */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Document Checklist</h3>
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{uploadedCount}</span> of{" "}
          <span className="font-semibold">{requiredItems.length}</span> required
          documents uploaded ({completionPercentage}%)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Document Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {checklistItems.map((item) => {
              const workflowDoc = getWorkflowDocForItem(item.id);
              const status = workflowDoc?.status || StatusEnum.PENDING;

              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {item.name}
                      </span>
                      {item.required && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {item.description || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ChecklistStatusBadge status={status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {renderItemActions(item)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {checklistItems.map((item) => {
          const workflowDoc = getWorkflowDocForItem(item.id);
          const status = workflowDoc?.status || StatusEnum.PENDING;

          return (
            <Card key={item.id} className="p-4 space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm">{item.name}</h4>
                  {item.required && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 whitespace-nowrap">
                      Required
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-1">
                    {item.description}
                  </p>
                )}
              </div>

              <div>
                <ChecklistStatusBadge status={status} />
              </div>

              <div className="pt-2">{renderItemActions(item)}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
