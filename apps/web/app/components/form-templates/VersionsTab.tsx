/**
 * SUP-32 PR B: Versions tab.
 *
 * Renders draft + immutable version rows from
 * `GET /api/form-templates/:id/versions`. No client-side fabrication —
 * if `data` is null the tab simply reports the read failure.
 */

import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type {
  FormTemplateVersionsListData,
  FormTemplateVersionListItem,
} from "@supplex/types";

interface VersionsTabProps {
  data: FormTemplateVersionsListData | null;
  /** True while the client is fetching versions (tab switch without loader revalidation). */
  loading?: boolean;
}

const STATUS_VARIANT: Record<
  FormTemplateVersionListItem["status"],
  "default" | "secondary" | "outline"
> = {
  draft: "secondary",
  published: "default",
  superseded: "outline",
};

function formatVersionLabel(row: FormTemplateVersionListItem): string {
  if (row.versionNumber == null) return "Draft";
  return `v${row.versionNumber}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function VersionsTab({ data, loading }: VersionsTabProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading versions…</p>;
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Versions are unavailable right now. Refresh the page to retry.
      </p>
    );
  }

  const versions = [...data.versions].sort((a, b) => {
    // Draft (null) first, then descending versionNumber so the most recent
    // immutable version is near the top.
    if (a.versionNumber == null && b.versionNumber != null) return -1;
    if (b.versionNumber == null && a.versionNumber != null) return 1;
    if (a.versionNumber == null || b.versionNumber == null) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    return b.versionNumber - a.versionNumber;
  });

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This template has no versions yet.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[20%]">Version</TableHead>
            <TableHead className="w-[20%]">Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">
                {formatVersionLabel(v)}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[v.status]}>{v.status}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(v.createdAt)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(v.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
