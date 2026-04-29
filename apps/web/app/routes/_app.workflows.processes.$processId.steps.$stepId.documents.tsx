/**
 * Workflow Step Documents Page
 * Story: 2.2.17 - Document upload & per-document validation
 * Revised: WFH-001 - Per-reviewer approval model with explicit validation rounds
 *
 * Serves two modes:
 *  1. Upload mode – uploader sees a checklist of required docs with file upload per item
 *  2. Validation mode – validator sees uploaded docs with approve/decline per item,
 *     using per-reviewer decisions from the current validation round
 */

import {
  data as json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  useLoaderData,
  useNavigate,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";
import { useState, useRef } from "react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { errorBody } from "~/lib/api-helpers";
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

export const meta: MetaFunction = () => [{ title: "Documents | Supplex" }];

interface ReviewerDecision {
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: string;
  decision: "approved" | "declined";
  comment: string | null;
  decidedAt: string;
  taskInstanceId: string;
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
  reviewerDecisions?: ReviewerDecision[];
}

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

  const docsResponse = await client.api.workflows
    .steps({ stepInstanceId: stepId })
    .documents.get();

  if (docsResponse.error) {
    const status = docsResponse.status || 500;
    if (status === 403) {
      throw new Response("You do not have access to this step's documents", {
        status: 403,
      });
    }
    throw new Response("Failed to load documents", { status });
  }

  // Trust-boundary cast via `unknown`: the API types `Date` fields, but
  // Remix/React-Router serializes them to ISO strings before reaching the
  // consumer; the local `StepDocument` shape (defined below) uses
  // post-serialization strings.
  const docsPayload = docsResponse.data as unknown as {
    success: boolean;
    data?: {
      stepName: string;
      stepStatus: string;
      validationRound?: number;
      documents: StepDocument[];
      summary: {
        total: number;
        uploaded: number;
        approved: number;
        declined: number;
        pending?: number;
      };
    };
  } | null;
  const docsData = docsPayload?.data;
  if (!docsData) {
    throw new Response("Invalid documents response", { status: 500 });
  }

  const processResponse = await client.api.workflows
    .processes({ processInstanceId: processId })
    .get();
  if (processResponse.error) {
    const status = processResponse.status || 500;
    if (status === 403) {
      throw new Response("You do not have access to this workflow process", {
        status: 403,
      });
    }
  }
  // Narrow only the `tasks` slice we actually consume in this loader.
  const processBody = processResponse.data as unknown as {
    success: boolean;
    data?: {
      tasks?: Array<{
        stepInstanceId?: string | null;
        status?: string;
        taskType?: string;
        assigneeUserId?: string | null;
        assigneeType?: string;
        assigneeRole?: string | null;
      }>;
    };
  } | null;
  const processData = processBody?.data;
  const userRole = userRecord?.role || "";
  const userId = supabaseUser.id;

  const tasks = processData?.tasks ?? [];
  const validationTask = tasks.find(
    (t) =>
      t.stepInstanceId === stepId &&
      t.status === "pending" &&
      t.taskType === "validation" &&
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
    validationRound: docsData.validationRound ?? 0,
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
    user,
  } = useLoaderData<typeof loader>();

  const navigate = useNavigate();
  const [docs, setDocs] = useState<StepDocument[]>(documents);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string>("");
  const [viewerName, setViewerName] = useState<string>("");
  const [decisions, setDecisions] = useState<
    Record<string, { action: "approve" | "decline"; comment?: string }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const client = createEdenTreatyClient(token);

  // Step-status guard: read-only for terminal statuses
  const isReadOnly =
    stepStatus === "validated" ||
    stepStatus === "completed" ||
    (stepStatus === "awaiting_validation" && !isValidationMode);

  const allRequiredUploaded = docs
    .filter((d) => d.required)
    .every((d) => d.status === "uploaded" || d.status === "approved");

  // In validation mode, docs needing a decision are those where the CURRENT USER
  // has not yet decided in the current round (using reviewerDecisions from the API)
  const docsNeedingDecision = isValidationMode
    ? docs.filter((d) => {
        if (!d.required && d.status === "pending" && !d.documentId)
          return false;
        const alreadyDecided = d.reviewerDecisions?.some(
          (rd) => rd.reviewerUserId === user.id
        );
        return !alreadyDecided;
      })
    : [];

  const allDecided =
    isValidationMode &&
    docsNeedingDecision.length > 0 &&
    docsNeedingDecision.every((d) => decisions[d.requiredDocumentName]);

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
      const res = await client.api.documents({ id: documentId }).view.get();
      const viewPayload = res.data as {
        success: boolean;
        data?: { url?: string; mimeType?: string; filename?: string };
      } | null;
      const data = viewPayload?.data;
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
      const res = await client.api.workflows
        .steps({ stepInstanceId: stepId })
        .complete.post({
          action: "submit",
        });

      if (res.error) {
        const errBody = errorBody(res.error);
        setError(errBody?.error.message || "Failed to submit documents");
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

  const _isViewable = (mimeType: string | null) => {
    if (!mimeType) return false;
    return mimeType === "application/pdf" || mimeType.startsWith("image/");
  };

  const currentUserAlreadyDecided = (doc: StepDocument) => {
    return (
      doc.reviewerDecisions?.some((rd) => rd.reviewerUserId === user.id) ??
      false
    );
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
          {isValidationMode
            ? "Review Documents"
            : isReadOnly
              ? "Documents"
              : "Upload Documents"}
        </h1>
        <p className="text-gray-500 mt-1">Step: {stepName}</p>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm text-gray-600">
            {summary.uploaded + summary.approved}/{summary.total} documents
            ready
          </span>
          {summary.declined > 0 && (
            <Badge className="bg-red-100 text-red-800">
              {summary.declined} declined
            </Badge>
          )}
        </div>
        {isReadOnly && !isValidationMode && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              {stepStatus === "awaiting_validation"
                ? "This step is awaiting validation by an assigned reviewer."
                : `This step has been ${stepStatus}.`}
            </p>
          </div>
        )}
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
          const userDecided = currentUserAlreadyDecided(doc);

          return (
            <Card
              key={doc.id}
              className={`p-4 ${doc.status === "declined" ? "border-red-300 bg-red-50/30" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <h3 className="font-medium text-gray-900 truncate">
                      {doc.requiredDocumentName}
                    </h3>
                    {doc.required && (
                      <span className="text-xs text-red-500 font-medium">
                        Required
                      </span>
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
                      {doc.fileSize &&
                        ` (${(doc.fileSize / 1024).toFixed(0)} KB)`}
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
                  {!isValidationMode &&
                    !isReadOnly &&
                    (doc.status === "pending" || doc.status === "declined") && (
                      <>
                        <input
                          type="file"
                          ref={(el) => {
                            fileInputRefs.current[doc.requiredDocumentName] =
                              el;
                          }}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(doc, file);
                          }}
                          accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.doc,.docx"
                        />
                        <Button
                          size="sm"
                          disabled={isUploading || submitting}
                          onClick={() =>
                            fileInputRefs.current[
                              doc.requiredDocumentName
                            ]?.click()
                          }
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
                  {!isValidationMode &&
                    !isReadOnly &&
                    doc.status === "uploaded" && (
                      <>
                        <input
                          type="file"
                          ref={(el) => {
                            fileInputRefs.current[
                              `replace_${doc.requiredDocumentName}`
                            ] = el;
                          }}
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
                          disabled={isUploading || submitting}
                          onClick={() =>
                            fileInputRefs.current[
                              `replace_${doc.requiredDocumentName}`
                            ]?.click()
                          }
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Replace"
                          )}
                        </Button>
                      </>
                    )}
                </div>
              </div>

              {/* Per-reviewer decision badges */}
              {isValidationMode &&
                doc.reviewerDecisions &&
                doc.reviewerDecisions.length > 0 && (
                  <div className="mt-2 ml-7 flex flex-wrap gap-2">
                    {(doc.reviewerDecisions as ReviewerDecision[]).map((rd) => (
                      <Badge
                        key={rd.taskInstanceId}
                        className={
                          rd.decision === "approved"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {rd.reviewerName} ({rd.reviewerRole}):{" "}
                        {rd.decision === "approved" ? "Approved" : "Declined"}
                      </Badge>
                    ))}
                  </div>
                )}

              {/* Validation mode: per-document approve/decline */}
              {isValidationMode && !userDecided && (
                <div className="mt-3 ml-7 pt-3 border-t">
                  {/* Non-required document that was not submitted */}
                  {!doc.required &&
                  doc.status === "pending" &&
                  !doc.documentId ? (
                    <p className="text-sm text-gray-500 italic">
                      Not mandatory document was not submitted.
                    </p>
                  ) : !decision ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={submitting}
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
                        disabled={submitting}
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [doc.requiredDocumentName]: {
                              action: "decline",
                              comment: "",
                            },
                          }))
                        }
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  ) : decision.action === "approve" ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800">
                        Will approve
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={submitting}
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
                        <Badge className="bg-red-100 text-red-800">
                          Will decline
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={submitting}
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
                        disabled={submitting}
                        value={decision.comment || ""}
                        onChange={(e) =>
                          setDecisions((prev) => ({
                            ...prev,
                            [doc.requiredDocumentName]: {
                              ...(prev[doc.requiredDocumentName] ?? {
                                action: "decline" as const,
                              }),
                              comment: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Show already-decided badge for current user in validation mode */}
              {isValidationMode && userDecided && (
                <div className="mt-3 ml-7 pt-3 border-t">
                  <Badge className="bg-green-100 text-green-800">
                    You have already reviewed this document
                  </Badge>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={submitting}
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
              Submit Review ({Object.keys(decisions).length}/
              {docsNeedingDecision.length})
            </Button>
          )}
        </div>
      )}

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

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  if (isRouteErrorResponse(error)) {
    const is403 = error.status === 403;
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {is403 ? "Access Denied" : `Error ${error.status}`}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {is403
              ? "You do not have permission to view these documents."
              : error.data || "Something went wrong"}
          </p>
          <Button onClick={() => navigate("/workflows")}>
            Back to Workflows
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Unexpected Error
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Something went wrong while loading the documents.
        </p>
        <Button onClick={() => navigate("/workflows")}>
          Back to Workflows
        </Button>
      </div>
    </div>
  );
}
