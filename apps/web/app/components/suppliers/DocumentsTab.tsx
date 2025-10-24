import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { DocumentUploadModal } from "./DocumentUploadModal";
import { DeleteDocumentModal } from "./DeleteDocumentModal";
import { DocumentExpiryBadge } from "./DocumentExpiryBadge";
import { usePermissions } from "~/hooks/usePermissions";
import { useToast } from "~/hooks/useToast";
import { useRevalidator } from "@remix-run/react";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { Document } from "@supplex/types";
import { Upload, Download, Trash2, FileText, ArrowUpDown } from "lucide-react";

interface DocumentsTabProps {
  supplierId: string;
  documents: Document[];
  token: string;
}

type SortField = "createdAt" | "expiryDate" | "documentType";
type SortOrder = "asc" | "desc";

/**
 * Documents Tab Component
 *
 * Main component for document management on supplier detail page
 * Displays list of documents with sorting, upload, download, and delete
 *
 * Uses Remix loader data for instant rendering and revalidation for mutations
 *
 * Acceptance Criteria: AC #1, #2, #11, #12
 */
export function DocumentsTab({
  supplierId,
  documents,
  token,
}: DocumentsTabProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    documentId: string;
    documentName: string;
  }>({ isOpen: false, documentId: "", documentName: "" });
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const permissions = usePermissions();
  const { toast } = useToast();
  const revalidator = useRevalidator();

  // Sort documents
  const sortedDocuments = [...documents].sort((a, b) => {
    let aValue: string | number | null = a[sortField] as string | null;
    let bValue: string | number | null = b[sortField] as string | null;

    if (sortField === "createdAt" || sortField === "expiryDate") {
      aValue = aValue ? new Date(aValue).getTime() : 0;
      bValue = bValue ? new Date(bValue).getTime() : 0;
    }

    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Download document
  const handleDownload = async (
    documentId: string,
    filename: string,
    mimeType: string
  ) => {
    try {
      const client = createEdenTreatyClient(token);
      const response = await client.api.documents[documentId].download.get();

      if (response.error) {
        throw new Error("Failed to generate download URL");
      }

      const { url } = response.data || {};
      if (!url) {
        throw new Error("No download URL returned");
      }

      // For PDFs, open in new tab; for others, trigger download
      if (mimeType === "application/pdf") {
        window.open(url, "_blank");
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Delete document
  const handleDeleteConfirm = async () => {
    try {
      const client = createEdenTreatyClient(token);
      const response =
        await client.api.documents[deleteModal.documentId].delete();

      if (response.error) {
        throw new Error("Failed to delete document");
      }

      toast({
        title: "Document deleted",
        description: "Document deleted successfully",
      });

      // Revalidate to refresh data from server (Remix pattern)
      revalidator.revalidate();

      // Close modal
      setDeleteModal({ isOpen: false, documentId: "", documentName: "" });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Handle successful upload - trigger revalidation
  const handleUploadSuccess = () => {
    // Revalidate to refresh data from server (Remix pattern)
    revalidator.revalidate();
    setIsUploadModalOpen(false);
  };

  // Document type label
  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      certificate: "Certificate",
      contract: "Contract",
      insurance: "Insurance",
      audit_report: "Audit Report",
      other: "Other",
    };
    return labels[type] || type;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Empty state
  if (documents.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No documents yet
        </h3>
        <p className="text-gray-600 mb-6">
          Upload your first document to get started
        </p>
        {permissions.canUploadDocument && (
          <Button onClick={() => setIsUploadModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        )}
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={handleUploadSuccess}
          supplierId={supplierId}
          token={token}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Upload Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Documents ({documents.length})
        </h3>
        {permissions.canUploadDocument && (
          <Button onClick={() => setIsUploadModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Filename
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  <button
                    onClick={() => handleSort("documentType")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Type
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  <button
                    onClick={() => handleSort("createdAt")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Upload Date
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  <button
                    onClick={() => handleSort("expiryDate")}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Expiry
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Size
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{doc.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="outline">
                      {getDocumentTypeLabel(doc.documentType)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(doc.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {doc.expiryDate ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
                          {formatDate(doc.expiryDate)}
                        </span>
                        <DocumentExpiryBadge expiryDate={doc.expiryDate} />
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownload(doc.id, doc.filename, doc.mimeType)
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {permissions.canDeleteDocument && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteModal({
                              isOpen: true,
                              documentId: doc.id,
                              documentName: doc.filename,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {sortedDocuments.map((doc) => (
          <Card key={doc.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {doc.filename}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {getDocumentTypeLabel(doc.documentType)}
                </Badge>
                <DocumentExpiryBadge expiryDate={doc.expiryDate} />
              </div>

              <div className="text-xs text-gray-600 space-y-1">
                <div>Uploaded: {formatDate(doc.createdAt)}</div>
                {doc.expiryDate && (
                  <div>Expires: {formatDate(doc.expiryDate)}</div>
                )}
                <div>Size: {formatFileSize(doc.fileSize)}</div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    handleDownload(doc.id, doc.filename, doc.mimeType)
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                {permissions.canDeleteDocument && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      setDeleteModal({
                        isOpen: true,
                        documentId: doc.id,
                        documentName: doc.filename,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
        supplierId={supplierId}
        token={token}
      />

      {/* Delete Confirmation Modal */}
      <DeleteDocumentModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, documentId: "", documentName: "" })
        }
        onConfirm={handleDeleteConfirm}
        documentName={deleteModal.documentName}
      />
    </div>
  );
}
