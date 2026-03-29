/**
 * Workflow Process Detail Page Component
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * Main component for displaying workflow process details
 */

import { useState, useEffect, useCallback } from "react";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { WorkflowStepTimeline } from "./WorkflowStepTimeline";
import { ActiveStepPanel } from "./ActiveStepPanel";
import { CommentThreadView } from "./CommentThreadView";
import { createClientEdenTreatyClient } from "~/lib/api-client";

interface ProcessInstance {
  id: string;
  tenantId: string;
  processType: string;
  entityType: string;
  entityId: string;
  status: string;
  initiatedBy: string;
  initiatedDate: string;
  completedDate?: string | null;
  updatedAt?: string;
  metadata: Record<string, any>;
  workflowName?: string | null;
  supplierName?: string | null;
}

interface StepInstance {
  id: string;
  tenantId: string;
  processInstanceId: string;
  stepOrder: number;
  stepName: string;
  stepType: string;
  status: string;
  assignedTo?: string | null;
  completedBy?: string | null;
  completedDate?: string | null;
  metadata: Record<string, any>;
}

interface TaskInstance {
  id: string;
  tenantId: string;
  processInstanceId: string;
  stepInstanceId: string;
  title: string;
  description?: string | null;
  assigneeType: string;
  assigneeRole?: string | null;
  assigneeUserId?: string | null;
  taskType?: string;
  status: string;
  outcome?: string | null;
  dueAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  metadata?: Record<string, any>;
  // User enrichment fields from API
  assignedUserFullName?: string | null;
  assignedUserEmail?: string | null;
  assignedUserRole?: string | null;
  completedByFullName?: string | null;
}

interface CommentThread {
  id: string;
  tenantId: string;
  processInstanceId: string;
  stepInstanceId: string;
  entityType: string;
  commentText: string;
  commentedBy: string;
  createdAt: string;
  parentCommentId?: string | null;
  commenterFullName?: string | null;
  commenterEmail?: string | null;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface ValidationInfo {
  stepId: string;
  requiresValidation: boolean;
}

interface WorkflowProcessDetailPageProps {
  process: ProcessInstance;
  steps: StepInstance[];
  tasks: TaskInstance[];
  comments: CommentThread[];
  formSubmissions?: Record<string, any>;
  documentProgress?: Record<string, any>;
  validationSteps?: ValidationInfo[];
  activeTab: string;
  token: string;
  user: User;
}

export function WorkflowProcessDetailPage({
  process,
  steps,
  tasks,
  comments,
  formSubmissions = {},
  documentProgress = {},
  validationSteps = [],
  activeTab,
  token,
  user,
}: WorkflowProcessDetailPageProps) {
  const [currentTab, setCurrentTab] = useState(activeTab);

  // Find the current actionable step (active or awaiting_validation)
  const activeStep =
    steps.find((s) => s.status === "active") ||
    steps.find((s) => s.status === "awaiting_validation");

  // Find user's open tasks for the active step specifically
  const userTasks = tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.stepInstanceId === activeStep?.id &&
      (t.assigneeUserId === user.id ||
        (t.assigneeType === "role" && t.assigneeRole === user.role))
  );

  const getAssignedUsersForStep = (stepId: string) => {
    const stepTasks = tasks.filter((t) => t.stepInstanceId === stepId);

    return stepTasks.map((task) => {
      const isRoleAssigned = task.assigneeType === "role" && !task.assigneeUserId;
      const roleName = (task.assigneeRole || "").replace(/_/g, " ");
      const isResubmission = task.taskType === "resubmission";

      return {
        taskId: task.id,
        taskTitle: task.title,
        status: task.status,
        isResubmission,
        fullName: isRoleAssigned
          ? `Any ${roleName}`
          : task.assignedUserFullName || "Unassigned",
        createdAt: task.createdAt || null,
        completedAt: task.status === "completed" ? (task.completedAt || task.updatedAt || null) : null,
      };
    }).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  };

  const STATUS_DISPLAY: Record<string, string> = {
    in_progress: "In Progress",
    pending_validation: "Pending Validation",
    declined_resubmit: "Declined - Re-Submit",
    complete: "Complete",
    cancelled: "Cancelled",
  };

  const getStatusLabel = (status: string, stepName?: string | null): string => {
    const label = STATUS_DISPLAY[status] || status;
    if (status === "complete" || status === "cancelled") return label;
    return stepName ? `${stepName} - ${label}` : label;
  };

  const getStatusColor = (status: string) => {
    if (status === "complete") return "bg-green-100 text-green-800";
    if (status === "in_progress") return "bg-blue-100 text-blue-800";
    if (status === "pending_validation") return "bg-amber-100 text-amber-800";
    if (status === "declined_resubmit") return "bg-red-100 text-red-800";
    if (status === "cancelled") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };

  const prettifyType = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const workflowRef = `WF-${process.id.slice(0, 4).toUpperCase()}`;
  const workflowTitle = process.workflowName || prettifyType(process.processType);
  const entityLabel = process.supplierName || process.entityId;
  const isTerminal = process.status === "complete" || process.status === "cancelled";

  // Waiting-on context for subtitle
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const hasSupplierWaiting = pendingTasks.some(
    (t) => t.assigneeRole === "supplier_user" || t.assignedUserRole === "supplier_user"
  );
  const waitingContext = isTerminal
    ? null
    : pendingTasks.length === 0
      ? null
      : hasSupplierWaiting
        ? "Waiting on Supplier"
        : "Internal review in progress";

  // Progress stats
  const completedSteps = steps.filter((s) => s.status === "complete").length;
  const totalSteps = steps.length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Open task stats
  const openTaskCount = pendingTasks.length;
  const now = new Date();
  const overdueTaskCount = pendingTasks.filter(
    (t) => t.dueAt && new Date(t.dueAt) < now
  ).length;

  // Due/urgency for current step
  const activeStepPendingTasks = activeStep
    ? pendingTasks.filter((t) => t.stepInstanceId === activeStep.id)
    : [];
  const earliestDue = activeStepPendingTasks
    .filter((t) => t.dueAt)
    .map((t) => new Date(t.dueAt!))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  function stepDueLabel(): { text: string; tone: string } | null {
    if (!earliestDue) return null;
    const diffDays = Math.ceil((earliestDue.getTime() - now.getTime()) / 86_400_000);
    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, tone: "text-red-600 bg-red-50 border-red-200" };
    if (diffDays === 0) return { text: "Due today", tone: "text-amber-700 bg-amber-50 border-amber-200" };
    if (diffDays === 1) return { text: "Due tomorrow", tone: "text-amber-700 bg-amber-50 border-amber-200" };
    return { text: `Due in ${diffDays} days`, tone: "text-gray-600 bg-gray-50 border-gray-200" };
  }

  const dueLabel = stepDueLabel();

  // Relative time helper
  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

          {/* Badge + Title + Context + Status */}
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                {prettifyType(process.processType)} &middot; {workflowRef}
              </span>
              <h1 className="mt-2 text-2xl font-semibold text-gray-900">
                {workflowTitle}
              </h1>
              {(entityLabel || waitingContext) && (
                <p className="mt-1 text-sm text-gray-500">
                  {entityLabel}
                  {waitingContext && <> &middot; {waitingContext}</>}
                </p>
              )}
            </div>
            <Badge className={`shrink-0 ${getStatusColor(process.status)}`}>
              {getStatusLabel(process.status, activeStep?.stepName)}
            </Badge>
          </div>

          {/* Compact stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Supplier */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Supplier</div>
              <div className="mt-1 font-medium text-gray-900">{entityLabel}</div>
              <div className="text-xs text-gray-500 capitalize">{process.entityType}</div>
            </div>
            {/* Started */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Started</div>
              <div className="mt-1 font-medium text-gray-900">
                {new Date(process.initiatedDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </div>
              {process.updatedAt && (
                <div className="text-xs text-gray-500">Updated {relativeTime(process.updatedAt)}</div>
              )}
            </div>
            {/* Progress */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Progress</div>
              <div className="mt-1 font-medium text-gray-900">{completedSteps} of {totalSteps} steps</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                  <div
                    className={`h-1.5 rounded-full ${isTerminal && process.status === "complete" ? "bg-green-500" : "bg-blue-500"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 tabular-nums">{progressPct}%</span>
              </div>
            </div>
            {/* Open Tasks */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Open Tasks</div>
              <div className="mt-1 font-medium text-gray-900">{openTaskCount}</div>
              {overdueTaskCount > 0 ? (
                <div className="text-xs font-medium text-red-600">{overdueTaskCount} overdue</div>
              ) : openTaskCount > 0 ? (
                <div className="text-xs text-green-600">All on track</div>
              ) : (
                <div className="text-xs text-gray-400">{isTerminal ? "Workflow closed" : "No pending tasks"}</div>
              )}
            </div>
          </div>

          {/* Current-step summary block */}
          {activeStep && !isTerminal && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-500">Current step</div>
                <div className="mt-0.5 font-medium text-gray-900">{activeStep.stepName}</div>
                <div className="mt-0.5 text-sm text-gray-500">
                  Step {activeStep.stepOrder} of {totalSteps}
                  {activeStep.stepType && <> &middot; {prettifyType(activeStep.stepType)}</>}
                </div>
              </div>
              {dueLabel && (
                <span className={`shrink-0 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${dueLabel.tone}`}>
                  {dueLabel.text}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Assignments (below header) */}
      {activeStep && !isTerminal && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Task Assignments</h3>
            {(() => {
              const assignedUsers = getAssignedUsersForStep(activeStep.id);

              if (assignedUsers.length === 0) {
                return (
                  <p className="text-gray-500 text-sm">
                    No tasks assigned for the current step.
                  </p>
                );
              }

              return (
                <>
                  {/* Desktop: Table */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Task</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Assigned To</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Created On</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Completed On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedUsers.map((u) => (
                          <tr
                            key={u.taskId}
                            className={`border-b last:border-0 ${u.status === "pending" ? "bg-blue-50/50 border-l-2 border-l-blue-500" : ""}`}
                          >
                            <td className="py-3 px-2 text-sm">
                              <div className="flex items-center space-x-2">
                                <span>{u.taskTitle}</span>
                                <Badge
                                  className={
                                    u.status === "completed"
                                      ? "bg-green-100 text-green-800"
                                      : u.isResubmission
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-blue-100 text-blue-800"
                                  }
                                >
                                  {u.status === "completed" ? "Completed" : u.isResubmission ? "Re-submission" : "Pending"}
                                </Badge>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-sm font-medium">{u.fullName}</td>
                            <td className="py-3 px-2 text-sm text-gray-600">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                            </td>
                            <td className="py-3 px-2 text-sm text-gray-600">
                              {u.completedAt ? new Date(u.completedAt).toLocaleDateString() : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: Card List */}
                  <div className="md:hidden space-y-3">
                    {assignedUsers.map((u) => (
                      <div
                        key={u.taskId}
                        className={`p-4 border rounded-lg space-y-2 ${u.status === "pending" ? "border-l-2 border-l-blue-500 bg-blue-50/30" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Task</p>
                            <p className="text-sm font-medium">{u.taskTitle}</p>
                          </div>
                          <Badge
                            className={
                              u.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : u.isResubmission
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                            }
                          >
                            {u.status === "completed" ? "Completed" : u.isResubmission ? "Re-submission" : "Pending"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Assigned To</p>
                          <p className="text-sm font-medium">{u.fullName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Created On</p>
                          <p className="text-sm text-gray-600">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Completed On</p>
                          <p className="text-sm text-gray-600">
                            {u.completedAt ? new Date(u.completedAt).toLocaleDateString() : "-"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <Tabs
          value={currentTab}
          onValueChange={setCurrentTab}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="comments">
              Comments {comments.length > 0 && `(${comments.length})`}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Step Timeline */}
            <WorkflowStepTimeline steps={steps} validationSteps={validationSteps} />

            {/* Active Step Panel */}
            {activeStep && (
              <ActiveStepPanel
                step={activeStep}
                userTasks={userTasks}
                processId={process.id}
                token={token}
                formSubmission={formSubmissions[activeStep.id]}
                documentProgress={documentProgress[activeStep.id] || null}
                processStatus={process.status}
                stepComments={comments.filter((c) => c.stepInstanceId === activeStep.id)}
              />
            )}

            {/* Completed Message */}
            {process.status === "complete" && (
              <Card className="p-6 text-center">
                <div className="text-green-600 mb-2">
                  <svg
                    className="w-16 h-16 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Workflow Completed
                </h3>
                <p className="text-gray-600">
                  This workflow has been successfully completed on{" "}
                  {process.completedDate &&
                    new Date(process.completedDate).toLocaleDateString()}
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="comments" className="mt-6 space-y-6">
            <CommentThreadView
              processId={process.id}
              comments={comments}
              token={token}
              steps={steps}
              activeStepId={activeStep?.id}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-6">
            <WorkflowHistory
              processId={process.id}
              token={token}
              isActive={currentTab === "history"}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const EVENT_DOT_COLORS: Record<string, string> = {
  process_instantiated: "bg-blue-500",
  process_completed: "bg-green-500",
  process_cancelled: "bg-gray-500",
  step_activated: "bg-blue-500",
  step_completed: "bg-green-500",
  step_validated: "bg-emerald-500",
  step_declined: "bg-red-500",
  step_returned: "bg-orange-500",
  task_created: "bg-gray-400",
  task_completed: "bg-blue-500",
  task_auto_closed: "bg-gray-400",
  form_submitted: "bg-green-500",
  form_resubmitted: "bg-green-500",
  validation_approved: "bg-emerald-500",
  validation_declined: "bg-red-500",
  validation_task_created: "bg-gray-400",
  document_uploaded: "bg-blue-500",
  document_approved: "bg-green-500",
  document_declined: "bg-red-500",
  supplier_status_changed: "bg-purple-500",
};

interface HistoryEvent {
  id: string;
  eventType: string;
  eventDescription: string;
  actorName: string;
  actorRole: string;
  comment: string | null;
  createdAt: string;
}

function WorkflowHistory({
  processId,
  token,
  isActive,
}: {
  processId: string;
  token: string;
  isActive: boolean;
}) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError(null);

    try {
      const client = createClientEdenTreatyClient(token);
      const response = await (client as any).api.workflows.processes[processId].events.get();

      if (response.data?.success && response.data.data) {
        setEvents(response.data.data.events);
      } else {
        setError("Failed to load history");
      }
    } catch {
      setError("Failed to load history");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [processId, token, loaded, loading]);

  useEffect(() => {
    if (isActive && !loaded) {
      fetchEvents();
    }
  }, [isActive, loaded, fetchEvents]);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Workflow History</h3>

      {loading && (
        <p className="text-gray-500 text-sm py-4 text-center">Loading history...</p>
      )}

      {error && (
        <p className="text-red-500 text-sm py-4 text-center">{error}</p>
      )}

      {loaded && !loading && events.length === 0 && (
        <p className="text-gray-500 text-sm py-4 text-center">
          No history events yet. Events will appear here as actions are performed.
        </p>
      )}

      {events.length > 0 && (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start space-x-4 pb-4 border-b last:border-0"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                  EVENT_DOT_COLORS[event.eventType] || "bg-gray-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{event.eventDescription}</p>
                <p className="text-sm text-gray-500">
                  by {event.actorName}{" "}
                  <span className="text-gray-400">
                    ({event.actorRole.replace(/_/g, " ")})
                  </span>
                </p>
                {event.comment && (
                  <p className="text-sm text-gray-600 mt-1 italic">
                    &ldquo;{event.comment}&rdquo;
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(event.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

