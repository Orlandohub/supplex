import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data as json } from "react-router";
import {
  useLoaderData,
  useNavigation,
  Link,
  useSearchParams,
} from "react-router";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { Button } from "~/components/ui/button";
import { DebouncedSearchInput } from "~/components/ui/debounced-search-input";
import { ClipboardList } from "lucide-react";

/* ===== Types ===== */

interface TaskItem {
  taskId: string;
  processId: string;
  stepId: string;
  taskTitle: string;
  taskDescription: string | null;
  taskStatus: string;
  dueAt: string | null;
  entityType: string;
  entityId: string;
  entityName: string;
  processStatus: string;
  processType: string;
  workflowName: string | null;
  initiatedDate: string;
  initiatedBy: string;
  daysPending: number;
  createdAt: string;
  completedAt: string | null;
  stepName?: string;
  isResubmission?: boolean;
}

interface Counts {
  pending: number;
  dueToday: number;
  overdue: number;
  waitingReview: number;
  completedThisWeek: number;
}

/* ===== Meta ===== */

export const meta: MetaFunction = () => [
  { title: "My Tasks | Supplex" },
  {
    name: "description",
    content: "Review and complete workflow tasks assigned to you.",
  },
];

/* ===== Loader ===== */

export async function loader(args: LoaderFunctionArgs) {
  const { session } = await requireAuth(args);
  const token = session?.access_token;
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const url = new URL(args.request.url);
  const queryParams: Record<string, string> = {};
  for (const key of ["view", "search", "status"]) {
    const val = url.searchParams.get(key);
    if (val && val !== "all") {
      queryParams[key] = val;
    }
  }

  const client = createEdenTreatyClient(token);

  try {
    const response = await client.api.workflows["my-tasks"].get({
      query: queryParams as any,
    });

    if (response.error) {
      console.error("API Error:", response.error);
      throw new Response("Failed to load tasks", { status: 500 });
    }

    const data = response.data as any;
    if (!data?.success || !data.data)
      throw new Response("Invalid API response", { status: 500 });

    return json({
      tasks: data.data.tasks as TaskItem[],
      counts: data.data.counts as Counts,
      token,
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Loader error:", error);
    throw new Response("Failed to load tasks", { status: 500 });
  }
}

/* ===== Helpers ===== */

const PROCESS_STATUS_DISPLAY: Record<string, string> = {
  in_progress: "In Progress",
  pending_validation: "Pending Validation",
  declined_resubmit: "Declined - Resubmit",
  complete: "Complete",
  cancelled: "Cancelled",
};

const PROCESS_STATUS_CLASSES: Record<string, string> = {
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  pending_validation: "border-amber-200 bg-amber-50 text-amber-700",
  declined_resubmit: "border-red-200 bg-red-50 text-red-700",
  complete: "border-green-200 bg-green-50 text-green-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-500",
};

const TASK_STATUS_CLASSES: Record<string, string> = {
  pending: "border-blue-200 bg-blue-50 text-blue-700",
  completed: "border-green-200 bg-green-50 text-green-700",
};

function prettifyType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function dueUrgency(task: TaskItem): {
  primary: string;
  secondary: string;
  tone: "red" | "amber" | "gray" | "muted";
} {
  if (task.taskStatus === "completed") {
    if (task.completedAt) {
      const diff = Date.now() - new Date(task.completedAt).getTime();
      const days = Math.floor(diff / 86_400_000);
      const label =
        days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
      return { primary: "Completed", secondary: label, tone: "gray" };
    }
    return { primary: "Completed", secondary: "", tone: "gray" };
  }

  if (!task.dueAt) {
    return { primary: "No due date", secondary: "", tone: "muted" };
  }

  const now = new Date();
  const due = new Date(task.dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  const timeStr = due.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffDays < 0) {
    return {
      primary: "Overdue",
      secondary: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""}`,
      tone: "red",
    };
  }

  const isToday = due.toDateString() === now.toDateString();
  if (isToday) {
    return { primary: "Today", secondary: timeStr, tone: "amber" };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due.toDateString() === tomorrow.toDateString()) {
    return { primary: "Tomorrow", secondary: timeStr, tone: "amber" };
  }

  const dateStr = due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return {
    primary: dateStr,
    secondary: `${diffDays} day${diffDays !== 1 ? "s" : ""} left`,
    tone: "muted",
  };
}

/* ===== Constants ===== */

const VIEW_TABS = [
  { value: "pending", label: "Pending" },
  { value: "due_today", label: "Due Today" },
  { value: "overdue", label: "Overdue" },
  { value: "waiting_review", label: "Waiting Review" },
  { value: "completed_this_week", label: "Completed This Week" },
  { value: "all", label: "All" },
] as const;

const EMPTY_STATES: Record<string, { title: string; desc: string }> = {
  pending: {
    title: "No Pending Tasks",
    desc: "You don't have any workflow tasks awaiting your action right now.",
  },
  due_today: {
    title: "Nothing Due Today",
    desc: "No tasks are due today. You're all caught up!",
  },
  overdue: {
    title: "No Overdue Tasks",
    desc: "All your tasks are on track. No overdue items detected.",
  },
  waiting_review: {
    title: "No Tasks Waiting Review",
    desc: "No validation tasks are waiting for your review.",
  },
  completed_this_week: {
    title: "No Completions This Week",
    desc: "No tasks have been completed this week yet.",
  },
  all: {
    title: "No Tasks Found",
    desc: "You don't have any workflow tasks assigned to you.",
  },
};

const DUE_TONE: Record<string, string> = {
  red: "text-red-600",
  amber: "text-amber-600",
  gray: "text-gray-400",
  muted: "text-gray-600",
};

/* ===== Page Component ===== */

export default function MyTasksPage() {
  const { tasks, counts } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLoading = navigation.state === "loading";

  const currentView = searchParams.get("view") || "pending";
  const currentSearch = searchParams.get("search") || "";

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  }

  function resetToPage1(updates: Record<string, string | null>) {
    updateParams({ ...updates, page: null });
  }

  function tabCount(v: string): number | null {
    if (v === "due_today") return counts.dueToday;
    if (v === "overdue") return counts.overdue;
    if (v === "waiting_review") return counts.waitingReview;
    if (v === "pending") return counts.pending;
    return null;
  }

  const empty = (EMPTY_STATES[currentView] ?? EMPTY_STATES.all) as {
    title: string;
    desc: string;
  };

  const summaryCards = [
    { label: "Pending", count: counts.pending, view: "pending" },
    { label: "Due Today", count: counts.dueToday, view: "due_today" },
    { label: "Overdue", count: counts.overdue, view: "overdue", warn: true },
    {
      label: "Waiting Review",
      count: counts.waitingReview,
      view: "waiting_review",
    },
    {
      label: "Completed This Week",
      count: counts.completedThisWeek,
      view: "completed_this_week",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* ── Top Panel ── */}
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200 space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">My Tasks</h1>
            <p className="mt-1 text-sm text-gray-500">
              Review and complete workflow tasks assigned to you.
            </p>
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
                      view: c.view === "pending" ? null : c.view,
                      search: null,
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
              const active =
                currentView === tab.value ||
                (currentView === "pending" &&
                  tab.value === "pending" &&
                  !searchParams.has("view"));
              const cnt = tabCount(tab.value);
              return (
                <button
                  key={tab.value}
                  onClick={() =>
                    resetToPage1({
                      view: tab.value === "pending" ? null : tab.value,
                      search: null,
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

          {/* Search */}
          <DebouncedSearchInput
            value={currentSearch}
            onChange={(v) => resetToPage1({ search: v || null })}
            placeholder="Search tasks, suppliers, workflows..."
            className="w-full"
          />
        </div>

        {/* ── Empty state ── */}
        {!isLoading && tasks.length === 0 && (
          <div className="rounded-lg bg-white p-12 shadow-sm ring-1 ring-gray-200 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {currentSearch ? "No Results" : empty.title}
            </h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {currentSearch
                ? `No tasks found matching "${currentSearch}"`
                : empty.desc}
            </p>
          </div>
        )}

        {/* ── Task List ── */}
        {tasks.length > 0 && (
          <div
            className={`rounded-lg bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden ${
              isLoading ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <div className="divide-y divide-gray-100">
              {tasks.map((task) => (
                <TaskRow key={task.taskId} task={task} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Row Component ===== */

function TaskRow({ task }: { task: TaskItem }) {
  const urgency = dueUrgency(task);
  const isCompleted = task.taskStatus === "completed";

  return (
    <div className="grid gap-x-6 gap-y-4 px-6 py-5 lg:grid-cols-3 lg:items-start">
      {/* ── Section 1: Task Identity ── */}
      <div className="space-y-1.5">
        <div className="font-semibold text-gray-900">{task.taskTitle}</div>
        <div>
          <div className="font-medium text-gray-900">{task.entityName}</div>
          <div className="text-sm text-gray-500 capitalize">
            {task.entityType}
          </div>
        </div>
        {task.workflowName && (
          <div className="text-sm text-gray-400">{task.workflowName}</div>
        )}
        {!task.workflowName && (
          <div className="text-sm text-gray-400">
            {prettifyType(task.processType)}
          </div>
        )}
      </div>

      {/* ── Section 2: Due Date (prominent) ── */}
      <div className="flex flex-col justify-center">
        <div className="text-xs text-gray-500 mb-0.5">Due</div>
        <div className={`text-lg font-semibold ${DUE_TONE[urgency.tone]}`}>
          {urgency.primary}
        </div>
        {urgency.secondary && (
          <div className={`text-sm font-medium ${DUE_TONE[urgency.tone]}`}>
            {urgency.secondary}
          </div>
        )}
      </div>

      {/* ── Section 3: Status + Action ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Task</div>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight ${
                TASK_STATUS_CLASSES[task.taskStatus] ??
                "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {task.taskStatus === "completed" ? "Completed" : "Pending"}
            </span>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Workflow step</div>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight ${
                PROCESS_STATUS_CLASSES[task.processStatus] ??
                "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {task.stepName
                ? `${task.stepName} - ${PROCESS_STATUS_DISPLAY[task.processStatus] ?? task.processStatus}`
                : (PROCESS_STATUS_DISPLAY[task.processStatus] ??
                  task.processStatus)}
            </span>
          </div>
          {task.isResubmission && (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 text-amber-700 px-2.5 py-0.5 text-[11px] font-medium leading-tight">
              Re-Submit
            </span>
          )}
        </div>
        <div className="shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link to={`/workflows/processes/${task.processId}`}>
              {isCompleted ? "View" : "Open"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
