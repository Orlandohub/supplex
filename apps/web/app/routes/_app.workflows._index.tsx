/**
 * Workflows Page - Operational Control Center
 *
 * Features:
 * - Summary strip with operational counters
 * - Pill-style view tabs (All, My Work, Waiting on Supplier, etc.)
 * - Server-side pagination, search, filtering, sorting
 * - 6-column responsive grid at xl+, card layout on smaller screens
 * - Contextual row actions
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data as json } from "react-router";
import {
  useLoaderData,
  useNavigation,
  Link,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import type { AppLoaderData } from "~/routes/_app";
import { Button } from "~/components/ui/button";
import { DebouncedSearchInput } from "~/components/ui/debounced-search-input";
import { PaginationControls } from "~/components/ui/pagination-controls";
import { InitiateWorkflowDialog } from "~/components/workflows/InitiateWorkflowDialog";
import { Workflow, Settings, Plus, Bell } from "lucide-react";

/* ===== Types ===== */

interface ProcessInstance {
  id: string;
  workflowName: string | null;
  processType: string;
  entityType: string;
  entityId: string;
  supplierName: string | null;
  status: string;
  currentStepName: string | null;
  currentStepOrder: number | null;
  currentStepType: string | null;
  currentStepInstanceId: string | null;
  totalStepCount: number;
  completedStepCount: number;
  waitingOnLabel: string;
  waitingOnIsSupplier: boolean;
  pendingTaskCount: number;
  overdueTaskCount: number;
  earliestDueAt: string | null;
  isAssignedToMe: boolean;
  myTaskType: string | null;
  initiatorName: string | null;
  initiatedDate: string;
  completedDate: string | null;
  updatedAt: string;
}

interface Counts {
  active: number;
  waitingOnSupplier: number;
  waitingOnInternal: number;
  overdue: number;
  completedThisMonth: number;
}

/* ===== Meta ===== */

export const meta: MetaFunction = () => [
  { title: "Workflows | Supplex" },
  {
    name: "description",
    content: "Manage and act on workflow processes across your organization",
  },
];

/* ===== Loader ===== */

export async function loader(args: LoaderFunctionArgs) {
  const { session, user } = await requireAuth(args);
  const token = session?.access_token;
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(args.request.url);
  const queryParams: Record<string, string> = {};
  for (const key of [
    "page",
    "pageSize",
    "search",
    "status",
    "view",
    "sortBy",
    "sortOrder",
  ]) {
    const val = url.searchParams.get(key);
    if (val && val !== "all" && val !== "all_statuses") {
      queryParams[key] = val;
    }
  }

  const client = createEdenTreatyClient(token);

  try {
    const response = await client.api.workflows.processes.get({
      query: queryParams as any,
    });

    if (response.error) {
      console.error("Processes API Error:", response.error);
      throw new Response(
        (response.error as any).message || "Failed to load processes",
        {
          status: response.status || 500,
        }
      );
    }

    const data = response.data as any;
    if (!data?.success || !data.data)
      throw new Response("Invalid API response", { status: 500 });

    return json({
      processes: data.data.processes as ProcessInstance[],
      total: data.data.total as number,
      page: data.data.page as number,
      pageSize: data.data.pageSize as number,
      counts: data.data.counts as Counts,
      token,
      user,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Loader error:", error);
    throw new Response("Failed to load workflow processes", { status: 500 });
  }
}

/* ===== Helpers ===== */

const STATUS_DISPLAY: Record<string, string> = {
  in_progress: "In Progress",
  pending_validation: "Pending Validation",
  declined_resubmit: "Declined - Resubmit",
  complete: "Complete",
  cancelled: "Cancelled",
};

const STATUS_CLASSES: Record<string, string> = {
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  pending_validation: "border-amber-200 bg-amber-50 text-amber-700",
  declined_resubmit: "border-red-200 bg-red-50 text-red-700",
  complete: "border-green-200 bg-green-50 text-green-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-500",
};

function statusClasses(s: string) {
  return STATUS_CLASSES[s] ?? "border-gray-200 bg-gray-50 text-gray-600";
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function prettifyType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function dueInfo(
  p: ProcessInstance
): { text: string; meta: string; tone: "red" | "amber" | "muted" } | null {
  if (!p.earliestDueAt) return null;
  const days = Math.ceil(
    (new Date(p.earliestDueAt).getTime() - Date.now()) / 86_400_000
  );
  if (days < 0)
    return {
      text: shortDate(p.earliestDueAt),
      meta: `${Math.abs(days)}d overdue`,
      tone: "red",
    };
  if (days === 0)
    return {
      text: shortDate(p.earliestDueAt),
      meta: "Due today",
      tone: "amber",
    };
  if (days === 1)
    return {
      text: shortDate(p.earliestDueAt),
      meta: "Due tomorrow",
      tone: "amber",
    };
  if (days <= 7)
    return {
      text: shortDate(p.earliestDueAt),
      meta: `${days} days left`,
      tone: "amber",
    };
  return {
    text: shortDate(p.earliestDueAt),
    meta: `${days} days left`,
    tone: "muted",
  };
}

function rowTone(p: ProcessInstance): "red" | "amber" | "blue" | "gray" {
  if (p.overdueTaskCount > 0) return "red";
  if (p.status === "pending_validation" || p.status === "declined_resubmit")
    return "amber";
  if (p.status === "complete" || p.status === "cancelled") return "gray";
  return "blue";
}

const TONE_BAR: Record<string, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  gray: "bg-gray-400",
};

const TONE_PILL: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  gray: "border-gray-200 bg-gray-50 text-gray-500",
};

function primaryAction(p: ProcessInstance): { label: string; href: string } {
  const base = `/workflows/processes/${p.id}`;
  if (
    p.status === "complete" ||
    p.status === "cancelled" ||
    !p.isAssignedToMe ||
    !p.currentStepType
  ) {
    return { label: "Open Workflow", href: base };
  }
  const isVal = p.myTaskType === "validation";
  const stepBase = `${base}/steps/${p.currentStepInstanceId}`;
  switch (p.currentStepType) {
    case "form":
      return {
        label: isVal ? "Review Form" : "Fill Form",
        href: `${stepBase}/form`,
      };
    case "document_upload":
      return {
        label: isVal ? "Review Docs" : "Upload Docs",
        href: `${stepBase}/documents`,
      };
    default:
      return { label: "Continue", href: base };
  }
}

function taskSummary(p: ProcessInstance): string {
  const parts: string[] = [];
  if (p.pendingTaskCount > 0) parts.push(`${p.pendingTaskCount} open`);
  if (p.overdueTaskCount > 0) parts.push(`${p.overdueTaskCount} overdue`);
  return parts.join(" \u00B7 ");
}

/* ===== Constants ===== */

const VIEW_TABS = [
  { value: "all", label: "All" },
  { value: "my_work", label: "My Work" },
  { value: "waiting_supplier", label: "Waiting on Supplier" },
  { value: "waiting_internal", label: "Waiting on Internal" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
] as const;

const EMPTY_STATES: Record<string, { title: string; desc: string }> = {
  all: {
    title: "No Workflow Processes",
    desc: "No workflow processes have been initiated yet. Start by initiating a new workflow.",
  },
  my_work: {
    title: "No Tasks Assigned to You",
    desc: "You have no workflows requiring your action right now.",
  },
  waiting_supplier: {
    title: "No Workflows Waiting on Supplier",
    desc: "No workflows are currently waiting for supplier action.",
  },
  waiting_internal: {
    title: "No Workflows Waiting Internally",
    desc: "No workflows are currently waiting for internal team action.",
  },
  overdue: {
    title: "No Overdue Workflows",
    desc: "All workflows are on track. No overdue tasks detected.",
  },
  completed: {
    title: "No Completed Workflows",
    desc: "No workflows have been completed yet.",
  },
};

const STATUS_OPTIONS = [
  { value: "all_statuses", label: "All Statuses" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending_validation", label: "Pending Validation" },
  { value: "declined_resubmit", label: "Declined - Resubmit" },
  { value: "cancelled", label: "Cancelled" },
];

/* ===== Page Component ===== */

export default function WorkflowsIndex() {
  const { processes, total, page, pageSize, counts, token, user } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const appData = useRouteLoaderData<AppLoaderData>("routes/_app");
  const permissions = appData?.permissions;
  const isLoading = navigation.state === "loading";

  const currentView = searchParams.get("view") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "";

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all" || value === "all_statuses")
        next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  }

  function resetToPage1(updates: Record<string, string | null>) {
    updateParams({ ...updates, page: null });
  }

  function tabCount(v: string): number | null {
    if (v === "waiting_supplier") return counts.waitingOnSupplier;
    if (v === "waiting_internal") return counts.waitingOnInternal;
    if (v === "overdue") return counts.overdue;
    return null;
  }

  const empty = EMPTY_STATES[currentView] ?? EMPTY_STATES.all;

  async function handleSendReminder(pid: string) {
    try {
      const c = createEdenTreatyClient(token);
      await (c.api.workflows.processes as any)[pid]["send-reminder"].post();
    } catch (err) {
      console.error("Failed to send reminder:", err);
    }
  }

  const summaryCards = [
    { label: "Active", count: counts.active, view: "all" },
    {
      label: "Waiting on Supplier",
      count: counts.waitingOnSupplier,
      view: "waiting_supplier",
    },
    {
      label: "Waiting on Internal",
      count: counts.waitingOnInternal,
      view: "waiting_internal",
    },
    { label: "Overdue", count: counts.overdue, view: "overdue", warn: true },
    {
      label: "Completed This Month",
      count: counts.completedThisMonth,
      view: "completed",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* ── Top Panel ─────────────────────────────────────── */}
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200 space-y-5">
          {/* Header row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Workflows
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track qualification, evaluation, and complaint processes in one
                operational view.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {permissions?.isAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link
                    to="/settings/workflow-templates"
                    className="inline-flex items-center"
                  >
                    <Settings className="mr-1.5 h-4 w-4" />
                    Manage Templates
                  </Link>
                </Button>
              )}
              {permissions?.canCreateSuppliers && (
                <InitiateWorkflowDialog token={token} user={user}>
                  <Button size="sm">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Initiate Workflow
                  </Button>
                </InitiateWorkflowDialog>
              )}
            </div>
          </div>

          {/* Summary strip */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {summaryCards.map((c) => {
              const active = currentView === c.view;
              return (
                <button
                  key={c.view}
                  onClick={() =>
                    resetToPage1({
                      view: c.view === "all" ? null : c.view,
                      status: null,
                    })
                  }
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? "border-gray-400 bg-gray-50 ring-1 ring-gray-300"
                      : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    {c.label}
                  </div>
                  <div
                    className={`mt-1 text-2xl font-semibold tabular-nums ${
                      c.warn && c.count > 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {c.count}
                  </div>
                </button>
              );
            })}
          </div>

          {/* View tabs */}
          <div className="flex flex-wrap gap-1.5">
            {VIEW_TABS.map((tab) => {
              const active = currentView === tab.value;
              const cnt = tabCount(tab.value);
              return (
                <button
                  key={tab.value}
                  onClick={() =>
                    resetToPage1({
                      view: tab.value === "all" ? null : tab.value,
                      status: null,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                  {cnt != null && cnt > 0 && (
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold min-w-[18px] ${
                        active
                          ? tab.value === "overdue"
                            ? "bg-red-500 text-white"
                            : "bg-white/20 text-white"
                          : tab.value === "overdue"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search + status filter */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DebouncedSearchInput
              value={currentSearch}
              onChange={(v) => resetToPage1({ search: v || null })}
              placeholder="Search workflows, suppliers..."
              className="flex-1 min-w-0"
            />
            {currentView === "all" && (
              <select
                value={currentStatus || "all_statuses"}
                onChange={(e) =>
                  resetToPage1({
                    status:
                      e.target.value === "all_statuses" ? null : e.target.value,
                  })
                }
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 sm:w-48"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Empty state ───────────────────────────────────── */}
        {!isLoading && processes.length === 0 && (
          <div className="rounded-lg bg-white p-12 shadow-sm ring-1 ring-gray-200 text-center">
            <Workflow className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {currentSearch ? "No Results" : empty.title}
            </h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-5">
              {currentSearch
                ? `No workflows found matching "${currentSearch}"`
                : empty.desc}
            </p>
            {currentView === "all" &&
              !currentSearch &&
              permissions?.canCreateSuppliers && (
                <InitiateWorkflowDialog token={token} user={user}>
                  <Button size="sm">
                    <Plus className="mr-1.5 h-4 w-4" />
                    Initiate Workflow
                  </Button>
                </InitiateWorkflowDialog>
              )}
          </div>
        )}

        {/* ── Workflow List ──────────────────────────────────── */}
        {processes.length > 0 && (
          <div
            className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden ${
              isLoading ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <div className="divide-y divide-gray-100">
              {processes.map((p) => (
                <WorkflowRow
                  key={p.id}
                  process={p}
                  permissions={permissions}
                  onSendReminder={handleSendReminder}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────── */}
        {processes.length > 0 && (
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(pg) => updateParams({ page: String(pg) })}
            onPageSizeChange={(ps) => resetToPage1({ pageSize: String(ps) })}
          />
        )}
      </div>
    </div>
  );
}

/* ===== Row Component (3-section layout) ===== */

function WorkflowRow({
  process: p,
  permissions,
  onSendReminder,
}: {
  process: ProcessInstance;
  permissions: AppLoaderData["permissions"] | undefined;
  onSendReminder: (id: string) => void;
}) {
  const tone = rowTone(p);
  const due = dueInfo(p);
  const action = primaryAction(p);
  const tasks = taskSummary(p);
  const pct =
    p.totalStepCount > 0
      ? Math.round((p.completedStepCount / p.totalStepCount) * 100)
      : 0;
  const isTerminal = p.status === "complete" || p.status === "cancelled";

  return (
    <div className="grid gap-x-6 gap-y-4 px-6 py-5 lg:grid-cols-3 lg:items-start">
      {/* ── Section 1: Identity ── */}
      <div className="space-y-2">
        <div>
          <div className="font-semibold text-gray-900">
            {p.workflowName || prettifyType(p.processType)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight ${statusClasses(p.status)}`}
            >
              {STATUS_DISPLAY[p.status] ?? p.status}
            </span>
            <span className="text-xs text-gray-400 capitalize">
              {p.processType.replace(/_/g, " ")}
            </span>
          </div>
        </div>
        <div>
          <div className="font-medium text-gray-900">
            {p.supplierName || p.entityId}
          </div>
          <div className="text-sm text-gray-500 capitalize">{p.entityType}</div>
        </div>
      </div>

      {/* ── Section 2: Current Step + Progress ── */}
      <div className="space-y-2">
        {isTerminal ? (
          <div className="text-gray-400">
            {p.status === "complete" ? "Completed" : "Cancelled"}
          </div>
        ) : (
          <>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Current task</div>
              <div className="font-medium text-gray-900">
                {p.currentStepName || "—"}
              </div>
              {p.totalStepCount > 0 && (
                <div className="mt-0.5 text-sm text-gray-500">
                  Step {p.currentStepOrder} of {p.totalStepCount}
                </div>
              )}
            </div>
            {p.totalStepCount > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-gray-100">
                  <div
                    className={`h-1.5 rounded-full ${TONE_BAR[tone]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 tabular-nums">
                  {p.completedStepCount}/{p.totalStepCount}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Section 3: Responsibility + Schedule + Actions ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3 min-w-0">
          {/* Assigned to */}
          {!isTerminal && (
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Assigned to</div>
              <div
                className={`font-medium ${p.waitingOnLabel === "Unassigned" ? "text-gray-400" : "text-gray-900"}`}
              >
                {p.waitingOnLabel}
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {p.waitingOnIsSupplier && (
                  <span className="inline-flex rounded-full bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 font-medium">
                    Supplier
                  </span>
                )}
                {!p.waitingOnIsSupplier &&
                  p.waitingOnLabel !== "Unassigned" && (
                    <span className="inline-flex rounded-full bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 font-medium">
                      Internal
                    </span>
                  )}
                {tasks && (
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight ${TONE_PILL[tone]}`}
                  >
                    {tasks}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Schedule: Due + Updated */}
          <div className="flex items-baseline gap-4 flex-wrap text-sm">
            {due && (
              <span>
                <span className="text-gray-500">Due </span>
                <span className="font-medium text-gray-900">{due.text}</span>
                <span
                  className={`ml-1 ${
                    due.tone === "red"
                      ? "text-red-600 font-medium"
                      : due.tone === "amber"
                        ? "text-amber-600"
                        : "text-gray-500"
                  }`}
                >
                  ({due.meta})
                </span>
              </span>
            )}
            <span className="text-gray-400" title={fullDate(p.updatedAt)}>
              Updated {relativeTime(p.updatedAt)}
            </span>
          </div>
        </div>

        {/* Actions - stacked vertically on the right */}
        <div className="flex flex-col gap-1.5 shrink-0 min-w-[140px]">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full justify-center"
          >
            <Link to={action.href}>{action.label}</Link>
          </Button>
          {(permissions?.isAdmin || permissions?.isProcurementManager) &&
            p.waitingOnIsSupplier &&
            (p.status === "in_progress" ||
              p.status === "pending_validation") && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center"
                onClick={() => onSendReminder(p.id)}
              >
                <Bell className="mr-1.5 h-3.5 w-3.5" />
                Send Reminder
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}
