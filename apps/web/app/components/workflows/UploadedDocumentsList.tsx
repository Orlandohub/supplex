import { useState } from "react";
import type { WorkflowDocumentWithDetails } from "@supplex/types";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Eye, Trash2 } from "lucide-react";
import { useRevalidator } from "@remix-run/react";
import { useToast } from "~/hooks/useToast";
import { ChecklistStatusBadge } from "./ChecklistStatusBadge";

interface UploadedDocumentsListProps {
  workflowDocuments: WorkflowDocumentWithDetails[];
  workflowId: string;
  token: string;
  canRemove: boolean;
}

/**
 * Uploaded Documents List Component
 * Displays list of uploaded documents with actions (AC 8, 10)
 *
 * Features:
 * - Table on desktop, cards on mobile
 * - Shows: Filename, Uploaded by, Upload date, Status
 * - Action buttons: View (download), Remove (if canRemove)
 * - Confirmation modal for remove
 * - Success toast after removal
 * - Revalidates to update checklist status
 */
export function UploadedDocumentsList({
  workflowDocuments,
  workflowId,
  token,
  canRemove,
}: UploadedDocumentsListProps) {
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const revalidator = useRevalidator();
  const { toast } = useToast();

  // Filter to only show documents that have been uploaded
  const uploadedDocs = workflowDocuments.filter((wd) => wd.document !== null);

  const handleViewDocument = async (documentId: string) => {
    try {
      // Call the download endpoint to get signed URL
      const response = await fetch(`/api/documents/${documentId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }

      const data = await response.json();

      // Open document in new tab
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: unknown) {
      console.error("View error:", error);
      toast({
        title: "Failed to view document",
        description:
          error instanceof Error
            ? error.message
            : "Could not retrieve document",
        variant: "destructive",
      });
    }
  };

  const handleRemoveDocument = async (documentId: string) => {
    setIsRemoving(true);

    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "Failed to remove document"
        );
      }

      toast({
        title: "Document removed from workflow",
        description: "The document has been unlinked from this checklist item.",
      });

      revalidator.revalidate();
      setConfirmRemove(null);
    } catch (error: unknown) {
      console.error("Remove error:", error);
      toast({
        title: "Failed to remove document",
        description:
          error instanceof Error ? error.message : "Could not remove document",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (uploadedDocs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Uploaded Documents</h3>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Upload Date
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
              {uploadedDocs.map((wd) => (
                <tr key={wd.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {wd.document?.filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {wd.document?.uploadedByName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {wd.document?.createdAt &&
                      formatDate(wd.document.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ChecklistStatusBadge status={wd.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDocument(wd.documentId!)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      {canRemove && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setConfirmRemove(wd.documentId!)}
                          className="gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {uploadedDocs.map((wd) => (
            <Card key={wd.id} className="p-4 space-y-3">
              <div>
                <h4 className="font-medium text-sm">{wd.document?.filename}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Uploaded by {wd.document?.uploadedByName} on{" "}
                  {wd.document?.createdAt && formatDate(wd.document.createdAt)}
                </p>
              </div>

              <div>
                <ChecklistStatusBadge status={wd.status} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewDocument(wd.documentId!)}
                  className="flex-1 gap-1"
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                {canRemove && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmRemove(wd.documentId!)}
                    className="flex-1 gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={confirmRemove !== null}
        onOpenChange={() => setConfirmRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Document?</DialogTitle>
            <DialogDescription>
              This will unlink the document from this checklist item. The
              document will remain in the supplier&apos;s documents but will no
              longer count toward workflow completion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmRemove(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmRemove && handleRemoveDocument(confirmRemove)
              }
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
