import { useState } from "react";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";
import { ApproveStageModal } from "./ApproveStageModal";
import { RejectStageModal } from "./RejectStageModal";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Download,
  Eye,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Link } from "@remix-run/react";

interface WorkflowReviewPageProps {
  workflow: any;
  supplier: any;
  documents: any[];
  stage: any;
  initiator: {
    fullName: string;
    email: string;
  };
  workflowHistory?: any | null;
  token: string;
}

/**
 * Workflow Review Page Component
 * AC 4, 5, 6, 7: Display complete workflow review with approve/reject actions
 *
 * Features:
 * - Supplier information card
 * - Risk assessment display
 * - Document checklist with view/download
 * - Review comments section
 * - Approve and Request Changes buttons
 * - Mobile-responsive layout
 */
export function WorkflowReviewPage({
  workflow,
  supplier,
  documents,
  stage,
  initiator,
  workflowHistory,
  token,
}: WorkflowReviewPageProps) {
  const [comments, setComments] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Stage 2 Quality Checklist State
  const [qualityManualReviewed, setQualityManualReviewed] = useState(false);
  const [qualityCertificationsVerified, setQualityCertificationsVerified] =
    useState(false);
  const [qualityAuditFindings, setQualityAuditFindings] = useState("");
  const [qualityChecklistError, setQualityChecklistError] = useState("");

  // Validate quality checklist for Stage 2
  const validateQualityChecklist = (): boolean => {
    if (stage.stageNumber !== 2) {
      return true; // No validation needed for other stages
    }

    // Check if quality checklist fields are complete
    if (!qualityManualReviewed) {
      setQualityChecklistError(
        "Please confirm that the quality manual has been reviewed"
      );
      return false;
    }

    if (!qualityCertificationsVerified) {
      setQualityChecklistError(
        "Please confirm that quality certifications have been verified"
      );
      return false;
    }

    if (!qualityAuditFindings.trim()) {
      setQualityChecklistError("Please provide quality audit findings");
      return false;
    }

    if (qualityAuditFindings.trim().length < 10) {
      setQualityChecklistError(
        "Quality audit findings must be at least 10 characters"
      );
      return false;
    }

    setQualityChecklistError("");
    return true;
  };

  // Handle approve button click with validation
  const handleApproveClick = () => {
    if (validateQualityChecklist()) {
      setShowApproveModal(true);
    } else {
      // Scroll to quality checklist section to show error
      document
        .getElementById("quality-checklist")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Get risk badge variant
  const getRiskBadgeVariant = (
    score: number
  ): "default" | "secondary" | "destructive" => {
    if (score >= 7) return "destructive";
    if (score >= 4) return "secondary";
    return "default";
  };

  // Format address
  const formatAddress = (address: any) => {
    if (!address) return "N/A";
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  // Format date
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get document view/download URLs
  const getDocumentUrl = (doc: any, action: "view" | "download") => {
    // TODO: Implement Supabase signed URL generation
    // For now, return placeholder
    return `/api/documents/${doc.document?.id}/${action}`;
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to="/tasks"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to My Tasks
            </Link>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {supplier.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Stage {stage.stageNumber}: {stage.stageName}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <WorkflowStatusBadge status={workflow.status} />
          <Badge variant={getRiskBadgeVariant(workflow.riskScore || 0)}>
            Risk: {workflow.riskScore?.toFixed(1) || "N/A"}
          </Badge>
        </div>
      </div>

      {/* Workflow Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workflow Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Initiated By</Label>
            <p className="font-medium">{initiator.fullName}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Initiated Date</Label>
            <p className="font-medium">{formatDate(workflow.initiatedDate)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Current Stage</Label>
            <p className="font-medium">
              Stage {stage.stageNumber}: {stage.stageName}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Assigned Date</Label>
            <p className="font-medium">{formatDate(stage.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Supplier Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Company Name
            </Label>
            <p className="font-medium">{supplier.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Tax ID</Label>
            <p className="font-medium">{supplier.taxId || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Category</Label>
            <p className="font-medium">{supplier.category || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Status</Label>
            <Badge variant="outline">{supplier.status}</Badge>
          </div>
          <div>
            <Label className="text-muted-foreground flex items-center gap-1">
              <Mail className="h-4 w-4" />
              Contact Email
            </Label>
            <p className="font-medium">{supplier.contactEmail || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground flex items-center gap-1">
              <Phone className="h-4 w-4" />
              Contact Phone
            </Label>
            <p className="font-medium">{supplier.contactPhone || "N/A"}</p>
          </div>
          <div className="col-span-1 md:col-span-2">
            <Label className="text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Address
            </Label>
            <p className="font-medium">{formatAddress(supplier.address)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      {workflow.riskScore && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-muted-foreground">
                  Overall Risk Score
                </Label>
                <p className="text-3xl font-bold">
                  {workflow.riskScore.toFixed(1)}
                </p>
              </div>
              <Badge
                variant={getRiskBadgeVariant(workflow.riskScore)}
                className="text-lg px-4 py-2"
              >
                {workflow.riskScore >= 7
                  ? "High Risk"
                  : workflow.riskScore >= 4
                    ? "Medium Risk"
                    : "Low Risk"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workflow.checklistItems && workflow.checklistItems.length > 0 ? (
            <div className="space-y-3">
              {workflow.checklistItems.map((item: any) => {
                const doc = documents.find(
                  (d) => d.checklistItemId === item.id
                );
                return (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.documentType}</p>
                        {item.required && (
                          <Badge variant="secondary" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                      {doc && doc.document && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <strong>File:</strong> {doc.document.filename}
                          <br />
                          <strong>Uploaded:</strong>{" "}
                          {formatDate(doc.document.createdAt)} by{" "}
                          {doc.document.uploadedByName}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {doc && doc.document ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(getDocumentUrl(doc, "view"), "_blank")
                            }
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(getDocumentUrl(doc, "download"))
                            }
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline">Not Uploaded</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No checklist items</p>
          )}
        </CardContent>
      </Card>

      {/* Stage 2: Quality Assessment Checklist */}
      {stage.stageNumber === 2 && (
        <Card id="quality-checklist">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Quality Assessment Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qualityChecklistError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive font-medium">
                  {qualityChecklistError}
                </p>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <Checkbox
                id="qualityManual"
                checked={qualityManualReviewed}
                onCheckedChange={(checked) => {
                  setQualityManualReviewed(checked as boolean);
                  if (checked && qualityChecklistError) {
                    setQualityChecklistError("");
                  }
                }}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="qualityManual"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Quality manual reviewed
                </label>
                <p className="text-sm text-muted-foreground">
                  Confirm that the supplier&apos;s quality manual has been
                  reviewed and meets requirements
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="qualityCerts"
                checked={qualityCertificationsVerified}
                onCheckedChange={(checked) => {
                  setQualityCertificationsVerified(checked as boolean);
                  if (checked && qualityChecklistError) {
                    setQualityChecklistError("");
                  }
                }}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="qualityCerts"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Quality certifications verified
                </label>
                <p className="text-sm text-muted-foreground">
                  Verify that all quality certifications (ISO, etc.) are valid
                  and current
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auditFindings">
                Quality Audit Findings{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="auditFindings"
                placeholder="Document any quality audit findings, observations, or recommendations (minimum 10 characters)..."
                value={qualityAuditFindings}
                onChange={(e) => {
                  setQualityAuditFindings(e.target.value);
                  if (
                    e.target.value.trim().length >= 10 &&
                    qualityChecklistError
                  ) {
                    setQualityChecklistError("");
                  }
                }}
                rows={3}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Record any findings from the quality assessment review (
                {qualityAuditFindings.length} characters, minimum 10 required)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage 3: Workflow History Summary */}
      {stage.stageNumber === 3 && workflowHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Previous Approval History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Overall Workflow Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-muted-foreground">Risk Score</Label>
                  <p className="text-2xl font-bold">
                    {workflowHistory.riskScore?.toFixed(1) || "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Document Completion
                  </Label>
                  <p className="text-2xl font-bold">
                    {workflowHistory.documentCompletionPercent}%
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Workflow Status
                  </Label>
                  <p className="font-medium">{workflowHistory.status}</p>
                </div>
              </div>

              {/* Stage-by-Stage History */}
              <div className="space-y-3">
                {workflowHistory.stages?.map((stageHistory: any) => (
                  <div
                    key={stageHistory.stageNumber}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">
                            Stage {stageHistory.stageNumber}
                          </Badge>
                          <span className="font-medium">
                            {stageHistory.stageName}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <Label className="text-muted-foreground">
                              Reviewer
                            </Label>
                            <p>
                              {stageHistory.reviewerName || "Pending Review"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              Review Date
                            </Label>
                            <p>
                              {stageHistory.reviewedDate
                                ? formatDate(stageHistory.reviewedDate)
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        {stageHistory.comments && (
                          <div className="mt-3">
                            <Label className="text-muted-foreground">
                              Comments
                            </Label>
                            <p className="text-sm mt-1">
                              {stageHistory.comments}
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <Badge
                          variant={
                            stageHistory.decision === "Approved"
                              ? "default"
                              : stageHistory.decision === "Rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {stageHistory.decision}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Review Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add your review comments (optional for approval, required for rejection with minimum 10 characters)..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground mt-2">
            {comments.length} characters
          </p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row justify-end gap-4 sticky bottom-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 rounded-lg border shadow-lg">
        <Button
          variant="destructive"
          size="lg"
          onClick={() => setShowRejectModal(true)}
          className="w-full md:w-auto"
        >
          Request Changes
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={handleApproveClick}
          className="w-full md:w-auto"
        >
          {stage.stageNumber === 1
            ? "Approve & Advance to Stage 2"
            : stage.stageNumber === 2
              ? "Approve & Advance to Stage 3"
              : "Approve & Complete Qualification"}
        </Button>
      </div>

      {/* Modals */}
      <ApproveStageModal
        open={showApproveModal}
        onOpenChange={setShowApproveModal}
        workflow={workflow}
        stage={stage}
        comments={comments}
        qualityChecklist={
          stage.stageNumber === 2
            ? {
                qualityManualReviewed,
                qualityCertificationsVerified,
                qualityAuditFindings,
              }
            : undefined
        }
        token={token}
      />

      <RejectStageModal
        open={showRejectModal}
        onOpenChange={setShowRejectModal}
        workflow={workflow}
        stage={stage}
        initialComments={comments}
        token={token}
      />
    </div>
  );
}
