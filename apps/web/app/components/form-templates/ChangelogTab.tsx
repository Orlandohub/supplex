/**
 * SUP-32 PR B: Changelog tab.
 *
 * Renders the form-template audit timeline from
 * `GET /api/form-templates/:id/audit-events` with cursor-based "Load
 * more" pagination. The first page comes from the loader; subsequent
 * pages are fetched client-side via Treaty to avoid revalidating the
 * whole route on each scroll-load.
 */

import { useState, useEffect } from "react";
import { createClientEdenTreatyClient } from "~/lib/api-client";
import {
  formTemplatesIndexParamsForId,
  withTreatyBranch,
} from "~/lib/api-helpers";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import type {
  FormTemplateAuditEventsListData,
  FormTemplateAuditEventListItem,
  FormTemplateAuditEventTypeWire,
} from "@supplex/types";
import { useToast } from "~/hooks/use-toast";

interface ChangelogTabProps {
  templateId: string;
  token: string;
  initialData: FormTemplateAuditEventsListData | null;
  /** True while the first page is being fetched on the client. */
  loading?: boolean;
}

const EVENT_LABEL: Record<FormTemplateAuditEventTypeWire, string> = {
  section_updated: "Section updated",
  section_hard_deleted: "Section deleted",
  field_updated: "Field updated",
  field_hard_deleted: "Field deleted",
  draft_subtree_replaced_on_publish: "Draft replaced on publish",
  version_published: "Version published",
  section_created: "Section created",
  field_created: "Field created",
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ChangelogTab({
  templateId,
  token,
  initialData,
  loading,
}: ChangelogTabProps) {
  const { toast } = useToast();
  const [events, setEvents] = useState<FormTemplateAuditEventListItem[]>(
    initialData?.events ?? []
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData?.nextCursor ?? null
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setEvents(initialData.events);
    setNextCursor(initialData.nextCursor);
  }, [initialData]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading changelog…</p>;
  }

  if (!initialData) {
    return (
      <p className="text-sm text-muted-foreground">
        Changelog is unavailable right now. Refresh the page to retry.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No audit events yet for this template.
      </p>
    );
  }

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const client = createClientEdenTreatyClient(token);
      const response = await withTreatyBranch(
        client.api["form-templates"](formTemplatesIndexParamsForId(templateId)),
        "audit-events"
      )["audit-events"].get({ query: { limit: 50, cursor: nextCursor } });

      if (response.error || !response.data?.success) {
        toast({
          title: "Could not load more events",
          description: "Try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      const page = response.data.data as FormTemplateAuditEventsListData;
      setEvents((prev) => [...prev, ...page.events]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="space-y-4">
      <ol className="relative space-y-4 border-l border-muted pl-6">
        {events.map((ev) => (
          <li key={ev.id} className="relative">
            <span className="absolute -left-[9px] top-2 h-3 w-3 rounded-full bg-primary" />
            <div className="flex flex-wrap items-baseline gap-2">
              <Badge variant="secondary">
                {EVENT_LABEL[ev.eventType] ?? ev.eventType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(ev.createdAt)}
              </span>
              {ev.actor && (
                <span className="text-xs text-muted-foreground">
                  by {ev.actor.fullName}
                </span>
              )}
            </div>
            {ev.summary && (
              <p className="mt-1 text-sm text-foreground">{ev.summary}</p>
            )}
          </li>
        ))}
      </ol>
      {nextCursor && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleLoadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
