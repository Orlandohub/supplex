/**
 * SUP-32 PR C: Compare tab.
 *
 * Lets an admin pick two versions of the same form template and renders
 * the structural diff from `GET /api/form-templates/:id/version-diff`.
 *
 * The versions list is pre-loaded by the route loader (the same call the
 * Versions tab uses) so the pickers can render synchronously. The diff
 * itself is fetched client-side once both pickers have a value — the
 * route loader stays cheap for first paint and round-trips only the
 * payload an admin actually requested.
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import type {
  FormTemplateVersionDiffData,
  FormTemplateVersionListItem,
  FormTemplateVersionsListData,
} from "@supplex/types";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import {
  errorBody,
  formTemplatesIndexParamsForId,
  withTreatyBranch,
} from "~/lib/api-helpers";

interface CompareTabProps {
  templateId: string;
  token: string;
  versions: FormTemplateVersionsListData | null;
  /** True while versions list is still being fetched for compare pickers. */
  versionsLoading?: boolean;
}

function versionLabel(v: FormTemplateVersionListItem): string {
  if (v.versionNumber == null) return "Draft";
  const suffix = v.status === "published" ? " (published)" : "";
  return `v${v.versionNumber}${suffix}`;
}

function sortVersionsForPicker(
  rows: readonly FormTemplateVersionListItem[]
): FormTemplateVersionListItem[] {
  // Most useful comparisons start from the newest immutable rows.
  // Draft (null) floats to the top, then descending versionNumber.
  return [...rows].sort((a, b) => {
    if (a.versionNumber == null && b.versionNumber != null) return -1;
    if (b.versionNumber == null && a.versionNumber != null) return 1;
    if (a.versionNumber == null || b.versionNumber == null) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    return b.versionNumber - a.versionNumber;
  });
}

function pickInitialPair(rows: readonly FormTemplateVersionListItem[]): {
  from: string | null;
  to: string | null;
} {
  const sorted = sortVersionsForPicker(rows);
  const top = sorted[0];
  const next = sorted[1];
  if (!top) return { from: null, to: null };
  if (!next) return { from: top.id, to: top.id };
  // Default to "previous head vs current head" so the diff is meaningful
  // on first paint when both exist.
  return { from: next.id, to: top.id };
}

export function CompareTab({
  templateId,
  token,
  versions,
  versionsLoading,
}: CompareTabProps) {
  const sortedVersions = useMemo(
    () => (versions ? sortVersionsForPicker(versions.versions) : []),
    [versions]
  );

  const initial = useMemo(
    () => pickInitialPair(sortedVersions),
    [sortedVersions]
  );
  const [fromVersionId, setFromVersionId] = useState<string | null>(
    initial.from
  );
  const [toVersionId, setToVersionId] = useState<string | null>(initial.to);

  useEffect(() => {
    const pair = pickInitialPair(sortedVersions);
    setFromVersionId(pair.from);
    setToVersionId(pair.to);
  }, [sortedVersions]);
  const [diff, setDiff] = useState<FormTemplateVersionDiffData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromVersionId || !toVersionId) {
      setDiff(null);
      setLoadError(null);
      return;
    }
    if (fromVersionId === toVersionId) {
      setDiff(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const client = createClientEdenTreatyClient(token);
        const response = await withTreatyBranch(
          client.api["form-templates"](
            formTemplatesIndexParamsForId(templateId)
          ),
          "version-diff"
        )["version-diff"].get({
          query: { fromVersionId, toVersionId },
        });

        if (cancelled) return;
        if (response.error || !response.data?.success) {
          const message =
            errorBody(response.error)?.error.message ??
            "Failed to load version diff.";
          setLoadError(message);
          setDiff(null);
          return;
        }
        setDiff(response.data.data as unknown as FormTemplateVersionDiffData);
      } catch {
        if (!cancelled) {
          setLoadError("Failed to load version diff.");
          setDiff(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fromVersionId, toVersionId, templateId, token]);

  if (versionsLoading && !versions) {
    return <p className="text-sm text-muted-foreground">Loading versions…</p>;
  }

  if (!versions) {
    return (
      <p className="text-sm text-muted-foreground">
        Versions are unavailable right now. Refresh the page to retry.
      </p>
    );
  }

  if (sortedVersions.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        At least two versions are needed to compare. Publish another version
        first.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="compare-from">From version</Label>
          <Select
            value={fromVersionId ?? undefined}
            onValueChange={setFromVersionId}
          >
            <SelectTrigger id="compare-from">
              <SelectValue placeholder="Select a version" />
            </SelectTrigger>
            <SelectContent>
              {sortedVersions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {versionLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="compare-to">To version</Label>
          <Select
            value={toVersionId ?? undefined}
            onValueChange={setToVersionId}
          >
            <SelectTrigger id="compare-to">
              <SelectValue placeholder="Select a version" />
            </SelectTrigger>
            <SelectContent>
              {sortedVersions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {versionLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fromVersionId && toVersionId && fromVersionId === toVersionId && (
        <p className="text-sm text-muted-foreground">
          Pick two different versions to see a diff.
        </p>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading diff…</p>
      )}

      {loadError && !isLoading && (
        <p className="text-sm text-destructive">{loadError}</p>
      )}

      {diff && !isLoading && !loadError && <CompareDiff data={diff} />}
    </div>
  );
}

function CompareDiff({ data }: { data: FormTemplateVersionDiffData }) {
  const { structureChanged, structureDiffSummary: s, diff } = data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {!structureChanged ? (
            <p className="text-muted-foreground">
              No structural changes between these versions.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-y-1 gap-x-6">
              <li>
                Sections added: <strong>{s.addedSectionCount}</strong>
              </li>
              <li>
                Sections removed: <strong>{s.removedSectionCount}</strong>
              </li>
              <li>
                Sections modified: <strong>{s.modifiedSectionCount}</strong>
              </li>
              <li>
                Fields added: <strong>{s.addedFieldCount}</strong>
              </li>
              <li>
                Fields removed: <strong>{s.removedFieldCount}</strong>
              </li>
              <li>
                Fields modified: <strong>{s.modifiedFieldCount}</strong>
              </li>
            </ul>
          )}
        </CardContent>
      </Card>

      {structureChanged && (
        <>
          {diff.addedSections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Sections added
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {diff.addedSections.map((sec) => (
                  <div key={sec.sectionKey} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{sec.title}</span>
                      <Badge variant="outline">
                        {sec.fields.length}{" "}
                        {sec.fields.length === 1 ? "field" : "fields"}
                      </Badge>
                    </div>
                    {sec.fields.length > 0 && (
                      <ul className="space-y-1 pl-2">
                        {sec.fields.map((f) => (
                          <li
                            key={f.fieldKey}
                            className="flex items-center gap-2"
                          >
                            <Badge variant="default">+</Badge>
                            <span>{f.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {f.fieldType}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {diff.removedSections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Sections removed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {diff.removedSections.map((sec) => (
                  <div
                    key={sec.sectionKey}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="font-medium">{sec.title}</span>
                    <Badge variant="outline">{sec.sectionKey}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {diff.modifiedSections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Sections modified
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {diff.modifiedSections.map((sec) => (
                  <div key={sec.sectionKey} className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{sec.titleAfter}</span>
                      {sec.titleBefore !== sec.titleAfter && (
                        <span className="text-xs text-muted-foreground">
                          (was &quot;{sec.titleBefore}&quot;)
                        </span>
                      )}
                    </div>

                    {sec.addedFields.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Fields added
                        </p>
                        <ul className="mt-1 space-y-1">
                          {sec.addedFields.map((f) => (
                            <li
                              key={f.fieldKey}
                              className="flex items-center gap-2"
                            >
                              <Badge variant="default">+</Badge>
                              <span>{f.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {f.fieldType}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sec.removedFields.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Fields removed
                        </p>
                        <ul className="mt-1 space-y-1">
                          {sec.removedFields.map((f) => (
                            <li
                              key={f.fieldKey}
                              className="flex items-center gap-2"
                            >
                              <Badge variant="outline">−</Badge>
                              <span>{f.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sec.modifiedFields.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Fields modified
                        </p>
                        <ul className="mt-1 space-y-1">
                          {sec.modifiedFields.map((f) => (
                            <li
                              key={f.fieldKey}
                              className="flex items-center gap-2"
                            >
                              <Badge variant="secondary">~</Badge>
                              <span>{f.after.label}</span>
                              {f.before.label !== f.after.label && (
                                <span className="text-xs text-muted-foreground">
                                  (was &quot;{f.before.label}&quot;)
                                </span>
                              )}
                              {f.before.fieldType !== f.after.fieldType && (
                                <span className="text-xs text-muted-foreground">
                                  type {f.before.fieldType} →{" "}
                                  {f.after.fieldType}
                                </span>
                              )}
                              {f.before.required !== f.after.required && (
                                <span className="text-xs text-muted-foreground">
                                  required {f.before.required ? "yes" : "no"} →{" "}
                                  {f.after.required ? "yes" : "no"}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
