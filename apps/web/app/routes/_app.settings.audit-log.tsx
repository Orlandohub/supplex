/**
 * Tenant-Wide Audit Log Page
 * Story: 2.2.12 - Immutable Audit Event Log
 *
 * Admin-only page displaying all workflow events for the tenant.
 * Server-side paginated with filters for event type, date range, and actor search.
 */

import { data as json, redirect, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { useState } from "react";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { hasPermission, PermissionAction } from "@supplex/types";

const EVENT_TYPE_OPTIONS = [
  { value: "", label: "All Event Types" },
  { value: "process_instantiated", label: "Process Instantiated" },
  { value: "process_completed", label: "Process Completed" },
  { value: "step_activated", label: "Step Activated" },
  { value: "step_completed", label: "Step Completed" },
  { value: "step_validated", label: "Step Validated" },
  { value: "step_declined", label: "Step Declined" },
  { value: "step_returned", label: "Step Returned" },
  { value: "form_submitted", label: "Form Submitted" },
  { value: "form_resubmitted", label: "Form Resubmitted" },
  { value: "validation_approved", label: "Validation Approved" },
  { value: "validation_declined", label: "Validation Declined" },
  { value: "document_uploaded", label: "Document Uploaded" },
  { value: "document_approved", label: "Document Approved" },
  { value: "document_declined", label: "Document Declined" },
  { value: "template_created", label: "Template Created" },
  { value: "template_updated", label: "Template Updated" },
  { value: "template_published", label: "Template Published" },
  { value: "template_copied", label: "Template Copied" },
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  process_instantiated: "bg-blue-100 text-blue-800",
  process_completed: "bg-green-100 text-green-800",
  process_cancelled: "bg-gray-100 text-gray-800",
  step_activated: "bg-blue-100 text-blue-800",
  step_completed: "bg-green-100 text-green-800",
  step_validated: "bg-emerald-100 text-emerald-800",
  step_declined: "bg-red-100 text-red-800",
  step_returned: "bg-orange-100 text-orange-800",
  form_submitted: "bg-green-100 text-green-800",
  form_resubmitted: "bg-green-100 text-green-800",
  validation_approved: "bg-emerald-100 text-emerald-800",
  validation_declined: "bg-red-100 text-red-800",
  template_created: "bg-indigo-100 text-indigo-800",
  template_updated: "bg-indigo-100 text-indigo-800",
  template_published: "bg-indigo-100 text-indigo-800",
  template_copied: "bg-indigo-100 text-indigo-800",
};

const PAGE_SIZE = 50;

export async function loader(args: LoaderFunctionArgs) {
  const { userRecord, session } = await requireAuth(args);

  if (!hasPermission(userRecord.role, PermissionAction.MANAGE_USERS)) {
    return redirect("/");
  }

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(args.request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const eventType = url.searchParams.get("eventType") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";
  const actor = url.searchParams.get("actor") || "";

  const client = createEdenTreatyClient(token);

  try {
    const query: Record<string, string> = {
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    };

    if (eventType) query.eventType = eventType;
    if (dateFrom) query.dateFrom = dateFrom;
    if (dateTo) query.dateTo = dateTo;
    if (actor) query.actor = actor;

    const response = await (client as any).api.workflows["audit-log"].get({
      query,
    });

    const data = response.data;
    if (!data?.success || !data.data) {
      return json({
        events: [],
        total: 0,
        page,
        filters: { eventType, dateFrom, dateTo, actor },
      });
    }

    return json({
      events: data.data.events,
      total: data.data.total,
      page,
      filters: { eventType, dateFrom, dateTo, actor },
    });
  } catch (error) {
    console.error("Audit log loader error:", error);
    return json({
      events: [],
      total: 0,
      page,
      filters: { eventType, dateFrom, dateTo, actor },
    });
  }
}

export default function AuditLogPage() {
  const { events, total, page, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [eventType, setEventType] = useState(filters.eventType || "__all");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom);
  const [dateTo, setDateTo] = useState(filters.dateTo);
  const [actor, setActor] = useState(filters.actor);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const applyFilters = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    if (eventType && eventType !== "__all") params.set("eventType", eventType);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (actor) params.set("actor", actor);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setEventType("__all");
    setDateFrom("");
    setDateTo("");
    setActor("");
    setSearchParams(new URLSearchParams());
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    setSearchParams(params);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-gray-500">
            All workflow events for your organization
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger>
              <SelectValue placeholder="All Event Types" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value || "__all"}
                  value={opt.value || "__all"}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />

          <Input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />

          <Input
            placeholder="Search by actor name..."
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />

          <div className="flex gap-2">
            <Button onClick={applyFilters} className="flex-1">
              Filter
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Date
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Event Type
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Description
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Actor
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Process
                </th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    No events found.
                  </td>
                </tr>
              ) : (
                events.map((event: any) => (
                  <tr key={event.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        className={
                          EVENT_TYPE_COLORS[event.eventType] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {event.eventType.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {event.eventDescription}
                      {event.comment && (
                        <p className="text-gray-500 text-xs italic mt-1">
                          &ldquo;{event.comment}&rdquo;
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p className="font-medium">{event.actorName}</p>
                      <p className="text-gray-500 text-xs">
                        {event.actorRole.replace(/_/g, " ")}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {event.processInstanceId ? (
                        <a
                          href={`/workflows/processes/${event.processInstanceId}`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          View Process
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm self-center px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
