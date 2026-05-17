/**
 * SUP-32 PR B: Usage tab.
 *
 * Renders workflow + active-pinned-process buckets from
 * `GET /api/form-templates/:id/usage`. Mirrors the publish dialog's
 * impact section so admins see a consistent view at any time, not just
 * during publish.
 */

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { FormTemplateUsageData } from "@supplex/types";

interface UsageTabProps {
  data: FormTemplateUsageData | null;
  loading?: boolean;
}

export function UsageTab({ data, loading }: UsageTabProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading usage…</p>;
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Usage is unavailable right now. Refresh the page to retry.
      </p>
    );
  }

  const { impact, publishedHeadVersionNumber } = data;
  const workflowRefs = impact.workflowTemplatesReferencingContainer;
  const activeProcesses = impact.activeProcessesWithSupersededPin;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Published head
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {publishedHeadVersionNumber == null ? (
            <p className="text-muted-foreground">
              This template has never been published.
            </p>
          ) : (
            <p>
              Current live version:{" "}
              <Badge variant="default">v{publishedHeadVersionNumber}</Badge>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Workflow templates referencing this form
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workflowRefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workflow templates reference this form template yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {workflowRefs.map((wf) => (
                <li key={wf.id} className="text-sm">
                  {wf.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Active processes pinned to the live version
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeProcesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No in-flight processes are pinned to the live version.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeProcesses.map((p) => (
                <li
                  key={p.id}
                  className="text-sm flex items-center justify-between gap-3"
                >
                  <span>{p.workflowName ?? "Unnamed process"}</span>
                  <Badge variant="outline">{p.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
