import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { DocumentTypeSelect } from "./DocumentTypeSelect";
import { DocumentType } from "@supplex/types";
import { Upload, X, FileIcon } from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { config } from "~/lib/config";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplierId: string;
  token: string;
}

// File validation constants
const ALLOWED_MIME_TYPES = [
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
 * Document Upload Modal Component
 *
 * Modal dialog for uploading documents with metadata
 * Supports multiple file selection, validation, and progress tracking
 *
 * Acceptance Criteria: AC #3, #4, #5, #13
 */
export function DocumentUploadModal({
  isOpen,
  onClose,
  onSuccess,
  supplierId,
  token,
}: DocumentUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>(
    DocumentType.OTHER
  );
  const [description, setDescription] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return `${file.name}: File type not supported. Please upload PDF, Excel, Word, PNG, or JPG files.`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB).`;
    }

    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const errors: string[] = [];
    const validFiles: File[] = [];

    files.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    setValidationErrors(errors);
    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }

    if (!documentType) {
      toast({
        title: "Document type required",
        description: "Please select a document type.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    let successCount = 0;

    try {
      // Upload files sequentially
      for (const file of selectedFiles) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("documentType", documentType);
          if (description) formData.append("description", description);
          if (expiryDate) formData.append("expiryDate", expiryDate);

          // Use fetch instead of Eden Treaty for FormData
          const response = await fetch(
            `${config.apiUrl}/api/suppliers/${supplierId}/documents`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            }
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Upload failed");
          }

          successCount++;
        } catch (error) {
          console.error(`Upload error for ${file.name}:`, error);
          toast({
            title: `Upload failed: ${file.name}`,
            description:
              error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      }

      // Show success message
      if (successCount > 0) {
        toast({
          title: "Upload successful",
          description: `${successCount} ${successCount === 1 ? "file" : "files"} uploaded successfully.`,
        });
        onSuccess();
        handleClose();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setDocumentType(DocumentType.OTHER);
    setDescription("");
    setExpiryDate("");
    setValidationErrors([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload documents for this supplier. Max 10MB per file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Picker */}
          <div>
            <Label htmlFor="file-upload">Select Files</Label>
            <div className="mt-2">
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center w-full h-32 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
              >
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    Click to select files or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, Excel, Word, PNG, JPG (max 10MB)
                  </p>
                </div>
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800 mb-1">
                Validation Errors:
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({selectedFiles.length})</Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <FileIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)}MB)
                      </span>
                    </div>
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Type */}
          <div>
            <Label htmlFor="document-type">
              Document Type <span className="text-red-500">*</span>
            </Label>
            <div className="mt-2">
              <DocumentTypeSelect
                value={documentType}
                onValueChange={(value) =>
                  setDocumentType(value as DocumentType)
                }
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or description about this document"
              rows={3}
              disabled={isUploading}
              className="mt-2"
            />
          </div>

          {/* Expiry Date */}
          <div>
            <Label htmlFor="expiry-date">Expiration Date (Optional)</Label>
            <Input
              id="expiry-date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={isUploading}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || selectedFiles.length === 0}
          >
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
