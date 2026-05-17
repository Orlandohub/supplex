/**
 * SUP-32 PR B: Publish confirmation dialog.
 *
 * Replaces one-click publish in the form-template admin. The dialog
 * opens, fetches `GET /api/form-templates/:id/publish-preview`, renders
 * the structure diff summary and publish impact, and only then calls
 * `PATCH /api/form-templates/:id/publish` on confirm. Body semantics
 * match the existing patch:
 *   - initial publish (status === "draft"): empty body
 *   - republish (status === "published"): `{ action: "publish" }`
 *
 * Unpublish stays out of this dialog — it has its own (lighter)
 * confirmation path on the builder.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import {
  errorBody,
  formTemplatesIndexParamsForId,
  withTreatyBranch,
} from "~/lib/api-helpers";
import { useToast } from "~/hooks/use-toast";
import type { FormTemplatePublishPreviewData } from "@supplex/types";

interface PublishConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateStatus: "draft" | "published" | "archived";
  token: string;
  /** Called after a successful publish so the parent can revalidate. */
  onPublished: () => void;
}

export function PublishConfirmationDialog({
  open,
  onOpenChange,
  templateId,
  templateStatus,
  token,
  onPublished,
}: PublishConfirmationDialogProps) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<FormTemplatePublishPreviewData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  /** Monotonic id so StrictMode double-invoke / rapid reopen ignores stale fetches. */
  const previewRequestIdRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    if (!templateId) {
      setPreview(null);
      setLoadError("Template is missing.");
      setIsLoading(false);
      return;
    }

    const requestId = ++previewRequestIdRef.current;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setPreview(null);

    (async () => {
      try {
        const client = createClientEdenTreatyClient(token);
        const response = await withTreatyBranch(
          client.api["form-templates"](
            formTemplatesIndexParamsForId(templateId)
          ),
          "publish-preview"
        )["publish-preview"].get();

        if (cancelled || requestId !== previewRequestIdRef.current) return;
        if (response.error || !response.data?.success) {
          const message =
            errorBody(response.error)?.error.message ??
            "Failed to load publish preview.";
          setLoadError(message);
          return;
        }
        setPreview(
          response.data.data as unknown as FormTemplatePublishPreviewData
        );
      } catch {
        if (!cancelled && requestId === previewRequestIdRef.current) {
          setLoadError("Failed to load publish preview.");
        }
      } finally {
        if (!cancelled && requestId === previewRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, templateId, token]);

  const handleConfirm = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const body =
        templateStatus === "published" ? { action: "publish" as const } : {};
      const response = await withTreatyBranch(
        client.api["form-templates"](formTemplatesIndexParamsForId(templateId)),
        "publish"
      ).publish.patch(body);

      if (response.error) {
        const errBody = errorBody(response.error);
        toast({
          title: "Publish failed",
          description:
            errBody?.error.message ?? "Failed to publish form template.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title:
          templateStatus === "published"
            ? "Version published"
            : "Template published",
        description:
          templateStatus === "published"
            ? "Draft changes are now the live published version."
            : "Form template is now live.",
      });

      onPublished();
      onOpenChange(false);
    } catch {
      toast({
        title: "Publish failed",
        description: "Unexpected error while publishing.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const summary = preview?.structureDiffSummary;
  const impact = preview?.publishImpact;
  const structureChanged = preview?.structureChanged ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {templateStatus === "published"
              ? "Publish changes to this form?"
              : "Publish this form template?"}
          </DialogTitle>
          <DialogDescription>
            Review the impact below before publishing.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading publish preview…
          </p>
        )}

        {loadError && !isLoading && (
          <p className="text-sm text-destructive">{loadError}</p>
        )}

        {preview && !isLoading && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Structure changes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {!structureChanged ? (
                  <p className="text-muted-foreground">
                    No structural changes since the last published version.
                  </p>
                ) : (
                  summary && (
                    <ul className="grid grid-cols-2 gap-y-1 gap-x-6">
                      <li>
                        Sections added:{" "}
                        <strong>{summary.addedSectionCount}</strong>
                      </li>
                      <li>
                        Sections removed:{" "}
                        <strong>{summary.removedSectionCount}</strong>
                      </li>
                      <li>
                        Sections modified:{" "}
                        <strong>{summary.modifiedSectionCount}</strong>
                      </li>
                      <li>
                        Fields added: <strong>{summary.addedFieldCount}</strong>
                      </li>
                      <li>
                        Fields removed:{" "}
                        <strong>{summary.removedFieldCount}</strong>
                      </li>
                      <li>
                        Fields modified:{" "}
                        <strong>{summary.modifiedFieldCount}</strong>
                      </li>
                    </ul>
                  )
                )}
              </CardContent>
            </Card>

            {impact && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Workflows and processes affected
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">
                      Workflow templates referencing this form
                    </p>
                    {impact.workflowTemplatesReferencingContainer.length ===
                    0 ? (
                      <p className="text-muted-foreground">None</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {impact.workflowTemplatesReferencingContainer.map(
                          (wf) => (
                            <li key={wf.id}>{wf.name}</li>
                          )
                        )}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="font-medium">
                      Active processes pinned to the current live version
                    </p>
                    {impact.activeProcessesWithSupersededPin.length === 0 ? (
                      <p className="text-muted-foreground">None</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {impact.activeProcessesWithSupersededPin.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span>{p.workflowName ?? "Unnamed process"}</span>
                            <Badge variant="outline">{p.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">What happens on publish</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  In-flight processes that have already started keep using their
                  pinned form version (immutable for those processes).
                </li>
                <li>
                  New process instances created after publish will use this new
                  published version.
                </li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={isPublishing || isLoading || Boolean(loadError)}
          >
            {isPublishing ? "Publishing…" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
