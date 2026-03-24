/**
 * Workflow Step Documents Page
 * Story: 2.2.17 - Document upload & per-document validation
 *
 * Serves two modes:
 *  1. Upload mode – uploader sees a checklist of required docs with file upload per item
 *  2. Validation mode – validator sees uploaded docs with approve/decline per item
 */

import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useState, useRef } from "react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Upload,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Send,
} from "lucide-react";

export const meta: MetaFunction = () => [
  { title: "Documents | Supplex" },
];

export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;
  const { session, user: supabaseUser, userRecord } = await requireAuth(args);

  const { processId, stepId } = params;
  if (!processId || !stepId) {
    throw new Response("Process ID and Step ID are required", { status: 400 });
  }

  const token = session?.access_token;
  if (!token) throw redirect("/login");

  const client = createEdenTreatyClient(token);

  const docsResponse = await client.api.workflows.steps[stepId].documents.get();

  if (docsResponse.error) {
    throw new Response("Failed to load documents", { status: 500 });
  }

  const docsData = (docsResponse.data as any)?.data;

  // Determine mode: if step is awaiting_validation and user has a validation task → validate
  const processResponse = await client.api.workflows.processes[processId].get();
  const processData = (processResponse.data as any)?.data;
  const userRole = userRecord?.role || "";
  const userId = supabaseUser.id;

  const tasks = processData?.tasks || [];
  const validationTask = tasks.find(
    (t: any) =>
      t.stepInstanceId === stepId &&
      t.status === "pending" &&
      (t.metadata as any)?.isValidationTask &&
      (t.assigneeUserId === userId ||
        (t.assigneeType === "role" && t.assigneeRole === userRole))
  );

  const isValidationMode =
    docsData.stepStatus === "awaiting_validation" && !!validationTask;

  return json({
    processId,
    stepId,
    stepName: docsData.stepName,
    stepStatus: docsData.stepStatus,
    documents: docsData.documents,
    summary: docsData.summary,
    isValidationMode,
    token,
    user: {
      id: userId,
      email: supabaseUser.email || "",
      role: userRole,
    },
  });
}

interface StepDocument {
  id: string;
  requiredDocumentName: string;
  documentId: string | null;
  status: string;
  declineComment: string | null;
  filename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  description: string | null;
  required: boolean;
  documentType: string | null;
}

export default function WorkflowStepDocumentsPage() {
  const {
    processId,
    stepId,
    stepName,
    stepStatus,
    documents,
    summary,
    isValidationMode,
    token,
  } = useLoaderData<typeof loader>();

  const navigate = useNavigate();
  const [docs, setDocs] = useState<StepDocument[]>(documents as any);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string>("");
  const [viewerName, setViewerName] = useState<string>("");
  const [decisions, setDecisions] = useState<Record<string, { action: "approve" | "decline"; comment?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const client = createEdenTreatyClient(token);

  const allRequiredUploaded = docs
    .filter((d) => d.required)
    .every((d) => d.status === "uploaded" || d.status === "approved");

  const uploadedDocs = docs.filter((d) => d.status === "uploaded" || d.status === "approved" || d.status === "declined");
  const docsNeedingDecision = isValidationMode ? uploadedDocs.filter((d) => d.status !== "approved") : [];
  const allDecided = isValidationMode && docsNeedingDecision.length > 0 && docsNeedingDecision.every((d) => decisions[d.requiredDocumentName]);

  const handleUpload = async (doc: StepDocument, file: File) => {
    setUploading((prev) => ({ ...prev, [doc.requiredDocumentName]: true }));
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const encodedName = encodeURIComponent(doc.requiredDocumentName);
      const res = await fetch(
        `${window.ENV?.API_URL || "http://localhost:3001"}/api/workflows/steps/${stepId}/documents/${encodedName}/upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const result = await res.json();
      if (!result.success) {
        setError(result.error || "Upload failed");
        return;
      }

      setDocs((prev) =>
        prev.map((d) =>
          d.requiredDocumentName === doc.requiredDocumentName
            ? {
                ...d,
                status: "uploaded",
                documentId: result.data.documentId,
                filename: result.data.filename,
                mimeType: result.data.mimeType,
                fileSize: result.data.fileSize,
                declineComment: null,
              }
            : d
        )
      );
    } catch (err) {
      setError("Failed to upload file");
      console.error(err);
    } finally {
      setUploading((prev) => ({ ...prev, [doc.requiredDocumentName]: false }));
    }
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const res = await client.api.documents[documentId].view.get();
      const data = (res.data as any)?.data;
      if (data?.url) {
        setViewerUrl(data.url);
        setViewerMime(data.mimeType || "");
        setViewerName(data.filename || "Document");
      }
    } catch (err) {
      console.error("Failed to get view URL:", err);
    }
  };

  const handleSubmitDocuments = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await client.api.workflows.steps[stepId].complete.post({
        action: "submit",
      });

      if ((res as any).error) {
        setError((res as any).error?.message || "Failed to submit documents");
        setSubmitting(false);
        return;
      }

      navigate(`/workflows/processes/${processId}`, { replace: true });
    } catch (err) {
      setError("Failed to submit documents");
      setSubmitting(false);
      console.error(err);
    }
  };

  const handleSubmitReview = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const decisionsArray = Object.entries(decisions).map(([name, d]) => ({
        requiredDocumentName: name,
        action: d.action,
        comment: d.comment,
      }));

      const res = await fetch(
        `${window.ENV?.API_URL || "http://localhost:3001"}/api/workflows/steps/${stepId}/documents/review`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decisions: decisionsArray }),
        }
      );

      const result = await res.json();
      if (!result.success) {
        setError(result.error || "Failed to submit review");
        setSubmitting(false);
        return;
      }

      navigate(`/workflows/processes/${processId}`, { replace: true });
    } catch (err) {
      setError("Failed to submit review");
      setSubmitting(false);
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "uploaded":
        return <Badge className="bg-blue-100 text-blue-800">Uploaded</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "declined":
        return <Badge className="bg-red-100 text-red-800">Declined</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600">Pending</Badge>;
    }
  };

  const isViewable = (mimeType: string | null) => {
    if (!mimeType) return false;
    return mimeType === "application/pdf" || mimeType.startsWith("image/");
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/workflows/processes/${processId}`)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Workflow
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isValidationMode ? "Review Documents" : "Upload Documents"}
        </h1>
        <p className="text-gray-500 mt-1">
          Step: {stepName}
        </p>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm text-gray-600">
            {summary.uploaded + summary.approved}/{summary.total} documents ready
          </span>
          {summary.declined > 0 && (
            <Badge className="bg-red-100 text-red-800">
              {summary.declined} declined
            </Badge>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Document List */}
      <div className="space-y-4">
        {docs.map((doc) => {
          const isUploading = uploading[doc.requiredDocumentName];
          const decision = decisions[doc.requiredDocumentName];

          return (
            <Card key={doc.id} className={`p-4 ${doc.status === "declined" ? "border-red-300 bg-red-50/30" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <h3 className="font-medium text-gray-900 truncate">
                      {doc.requiredDocumentName}
                    </h3>
                    {doc.required && (
                      <span className="text-xs text-red-500 font-medium">Required</span>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-sm text-gray-500 mt-1 ml-7">
                      {doc.description}
                    </p>
                  )}
                  {doc.filename && (
                    <p className="text-sm text-gray-600 mt-1 ml-7">
                      Uploaded: {doc.filename}
                      {doc.fileSize && ` (${(doc.fileSize / 1024).toFixed(0)} KB)`}
                    </p>
                  )}
                  {doc.declineComment && (
                    <div className="mt-2 ml-7 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      Declined: {doc.declineComment}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {getStatusBadge(doc.status)}

                  {/* View button for uploaded/approved docs */}
                  {doc.documentId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDocument(doc.documentId!)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Upload mode actions */}
                  {!isValidationMode && (doc.status === "pending" || doc.status === "declined") && (
                    <>
                      <input
                        type="file"
                        ref={(el) => { fileInputRefs.current[doc.requiredDocumentName] = el; }}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(doc, file);
                        }}
                        accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.doc,.docx"
                      />
                      <Button
                        size="sm"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[doc.requiredDocumentName]?.click()}
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1" />
                            Upload
                          </>
                        )}
                      </Button>
                    </>
                  )}

                  {/* Re-upload for uploaded docs (replace) */}
                  {!isValidationMode && doc.status === "uploaded" && (
                    <>
                      <input
                        type="file"
                        ref={(el) => { fileInputRefs.current[`replace_${doc.requiredDocumentName}`] = el; }}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(doc, file);
                        }}
                        accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.doc,.docx"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[`replace_${doc.requiredDocumentName}`]?.click()}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Replace"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Validation mode: per-document approve/decline */}
              {isValidationMode && doc.status !== "approved" && (
                <div className="mt-3 ml-7 pt-3 border-t">
                  {/* Non-required document that was not submitted */}
                  {!doc.required && doc.status === "pending" && !doc.documentId ? (
                    <p className="text-sm text-gray-500 italic">
                      Not mandatory document was not submitted.
                    </p>
                  ) : !decision ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [doc.requiredDocumentName]: { action: "approve" },
                          }))
                        }
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-600 text-red-600 hover:bg-red-50"
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [doc.requiredDocumentName]: { action: "decline", comment: "" },
                          }))
                        }
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  ) : decision.action === "approve" ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800">Will approve</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = { ...decisions };
                          delete next[doc.requiredDocumentName];
                          setDecisions(next);
                        }}
                      >
                        Undo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-100 text-red-800">Will decline</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const next = { ...decisions };
                            delete next[doc.requiredDocumentName];
                            setDecisions(next);
                          }}
                        >
                          Undo
                        </Button>
                      </div>
                      <textarea
                        className="w-full border rounded-md p-2 text-sm"
                        rows={2}
                        placeholder="Reason for declining this document..."
                        value={decision.comment || ""}
                        onChange={(e) =>
                          setDecisions((prev) => ({
                            ...prev,
                            [doc.requiredDocumentName]: {
                              ...prev[doc.requiredDocumentName],
                              comment: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Show existing approved badge for validation mode */}
              {isValidationMode && doc.status === "approved" && (
                <div className="mt-3 ml-7 pt-3 border-t">
                  <Badge className="bg-green-100 text-green-800">Previously approved</Badge>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => navigate(`/workflows/processes/${processId}`)}
        >
          Cancel
        </Button>

        {!isValidationMode ? (
          <Button
            disabled={!allRequiredUploaded || submitting}
            onClick={handleSubmitDocuments}
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Submit Documents
          </Button>
        ) : (
          <Button
            disabled={!allDecided || submitting}
            onClick={handleSubmitReview}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Submit Review ({Object.keys(decisions).length}/{docsNeedingDecision.length})
          </Button>
        )}
      </div>

      {/* Document Viewer Modal */}
      {viewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">{viewerName}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Open in new tab
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewerUrl(null)}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {viewerMime === "application/pdf" ? (
                <iframe
                  src={viewerUrl}
                  className="w-full h-[70vh] border rounded"
                  title={viewerName}
                />
              ) : viewerMime.startsWith("image/") ? (
                <img
                  src={viewerUrl}
                  alt={viewerName}
                  className="max-w-full max-h-[70vh] mx-auto object-contain"
                />
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 mb-4">
                    This file type cannot be previewed in the browser.
                  </p>
                  <a
                    href={viewerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
