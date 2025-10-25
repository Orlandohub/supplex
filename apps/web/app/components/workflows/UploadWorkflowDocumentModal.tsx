import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { useRevalidator } from "@remix-run/react";
import { useToast } from "~/hooks/useToast";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import { Upload, Link as LinkIcon } from "lucide-react";
import type { RequiredDocumentItem, Document } from "@supplex/types";

interface UploadWorkflowDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  checklistItem: RequiredDocumentItem;
  supplierDocuments: Document[];
  token: string;
}

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Upload Workflow Document Modal
 * Modal for uploading new document or linking existing document (AC 4, 5, 6, 7)
 *
 * Features:
 * - Two tabs: "Upload New" and "Link Existing"
 * - File picker with validation (PDF, Excel, Word, PNG, JPG, max 10MB)
 * - Progress bar during upload
 * - Dropdown of supplier's existing documents
 * - Success/error toast notifications
 * - Revalidates on success
 * - Mobile-optimized with large touch targets
 */
export function UploadWorkflowDocumentModal({
  open,
  onOpenChange,
  workflowId,
  checklistItem,
  supplierDocuments,
  token,
}: UploadWorkflowDocumentModalProps) {
  const [uploadOption, setUploadOption] = useState<"new" | "existing">("new");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentType, setDocumentType] = useState("other");
  const [description, setDescription] = useState("");
  const revalidator = useRevalidator();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, Excel, Word, PNG, or JPG files only.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `File size must be less than 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadNew = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("checklistItemId", checklistItem.id || "");
      formData.append("documentType", documentType);
      if (description) {
        formData.append("description", description);
      }

      // Use native fetch for upload progress tracking
      const response = await fetch(`/api/workflows/${workflowId}/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      // Simulate progress for now (in production, use XHR for real progress)
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Upload failed");
      }

      toast({
        title: "Document uploaded successfully",
        description: `${selectedFile.name} has been uploaded.`,
      });

      revalidator.revalidate();
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleLinkExisting = async () => {
    if (!selectedDocumentId) {
      toast({
        title: "No document selected",
        description: "Please select a document to link.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await client.api.workflows[workflowId].documents.post({
        checklistItemId: checklistItem.id || "",
        documentId: selectedDocumentId,
      });

      if (response?.error) {
        throw new Error(response.error.message || "Failed to link document");
      }

      toast({
        title: "Document linked successfully",
        description:
          "Existing document has been linked to this checklist item.",
      });

      revalidator.revalidate();
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      console.error("Link error:", error);
      toast({
        title: "Link failed",
        description:
          error instanceof Error ? error.message : "Failed to link document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setSelectedDocumentId("");
    setDocumentType("other");
    setDescription("");
    setUploadProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Document: {checklistItem.name}</DialogTitle>
          <DialogDescription>
            {checklistItem.description ||
              "Upload a new document or link an existing one from the supplier's documents."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={uploadOption}
          onValueChange={(v) => setUploadOption(v as "new" | "existing")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">
              <Upload className="h-4 w-4 mr-2" />
              Upload New
            </TabsTrigger>
            <TabsTrigger value="existing">
              <LinkIcon className="h-4 w-4 mr-2" />
              Link Existing
            </TabsTrigger>
          </TabsList>

          {/* Upload New Tab */}
          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.doc,.docx"
                onChange={handleFileChange}
                disabled={isUploading}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600">
                  Selected: {selectedFile.name} (
                  {(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                </p>
              )}
              <p className="text-xs text-gray-500">
                Accepted: PDF, Excel, Word, PNG, JPG (max 10MB)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type</Label>
              <select
                id="documentType"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="certificate">Certificate</option>
                <option value="contract">Contract</option>
                <option value="insurance">Insurance</option>
                <option value="audit_report">Audit Report</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUploading}
                placeholder="Add a description..."
              />
            </div>

            {isUploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <Label>Upload Progress</Label>
                <Progress value={uploadProgress} />
                <p className="text-xs text-gray-500 text-center">
                  {uploadProgress}%
                </p>
              </div>
            )}

            <Button
              onClick={handleUploadNew}
              disabled={!selectedFile || isUploading}
              className="w-full"
            >
              {isUploading ? "Uploading..." : "Upload Document"}
            </Button>
          </TabsContent>

          {/* Link Existing Tab */}
          <TabsContent value="existing" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="existingDoc">Select Existing Document</Label>
              {supplierDocuments.length > 0 ? (
                <select
                  id="existingDoc"
                  value={selectedDocumentId}
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                  disabled={isUploading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a document --</option>
                  {supplierDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename} ({doc.documentType})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500">
                  No existing documents available for this supplier.
                </p>
              )}
            </div>

            <Button
              onClick={handleLinkExisting}
              disabled={!selectedDocumentId || isUploading}
              className="w-full"
            >
              {isUploading ? "Linking..." : "Link Document"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
