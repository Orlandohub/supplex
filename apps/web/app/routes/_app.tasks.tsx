import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, useNavigate } from "@remix-run/react";
import { requireAuth } from "~/lib/auth/require-auth";
import { createEdenTreatyClient } from "~/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ClipboardList, AlertCircle } from "lucide-react";

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
  initiatedDate: string;
  initiatedBy: string;
  daysPending: number;
  createdAt: string;
  completedAt: string | null;
  isResubmission?: boolean;
}

export const meta: MetaFunction = () => {
  return [
    { title: "My Tasks | Supplex" },
    {
      name: "description",
      content: "Review pending workflow tasks assigned to you.",
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  const { session } = await requireAuth(args);
  const url = new URL(args.request.url);
  const statusFilter = url.searchParams.get("status") || "pending";

  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  try {
    const response = await client.api.workflows["my-tasks"].get({
      query: { status: statusFilter as any },
    });

    if (response.error) {
      console.error("API Error:", response.error);
      throw new Response("Failed to load tasks", { status: 500 });
    }

    const apiResponse = response.data as {
      success: boolean;
      data: {
        tasks: TaskItem[];
      };
    };

    return json({
      tasks: apiResponse.data.tasks,
      statusFilter,
      token,
    });
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    throw new Response("Failed to load tasks", { status: 500 });
  }
}

function getStatusBadge(processStatus: string, isResubmission?: boolean) {
  if (isResubmission) {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-300">
        Resubmission Required
      </Badge>
    );
  }

  const lower = processStatus.toLowerCase();
  if (lower.includes("approved")) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300">
        {processStatus}
      </Badge>
    );
  }

  return <Badge variant="secondary">{processStatus}</Badge>;
}

function getTaskStatusBadge(taskStatus: string) {
  if (taskStatus === "completed") {
    return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
  }
  return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
}

export default function MyTasksPage() {
  const { tasks, statusFilter } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const handleFilterChange = (newFilter: string) => {
    navigate(`/tasks?status=${newFilter}`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-8 w-8" />
            My Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and complete workflow tasks assigned to you
          </p>
        </div>
        {tasks.length > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {tasks.length} {statusFilter === "completed" ? "completed" : statusFilter === "all" ? "total" : "pending"}
          </Badge>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        {[
          { label: "Pending", value: "pending" },
          { label: "Completed", value: "completed" },
          { label: "All", value: "all" },
        ].map((filter) => (
          <Button
            key={filter.value}
            variant={statusFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Empty State */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Pending Tasks</h2>
            <p className="text-muted-foreground text-center max-w-md">
              You don&apos;t have any workflow tasks awaiting your action at this
              time. New tasks will appear here when workflows require your
              input or approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Initiated By</TableHead>
                    <TableHead>Initiated Date</TableHead>
                    <TableHead>Task Status</TableHead>
                    <TableHead>Workflow Status</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.taskId}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{task.taskTitle}</div>
                          {task.taskDescription && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {task.taskDescription}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{task.entityName}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {task.entityType}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{task.initiatedBy}</TableCell>
                      <TableCell>
                        {new Date(task.initiatedDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {getTaskStatusBadge(task.taskStatus)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(task.processStatus, task.isResubmission)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            task.daysPending > 7
                              ? "text-destructive font-semibold"
                              : ""
                          }
                        >
                          {task.daysPending}{" "}
                          {task.daysPending === 1 ? "day" : "days"}
                          {task.daysPending > 7 && (
                            <AlertCircle className="inline ml-1 h-4 w-4" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm">
                          <Link to={`/workflows/processes/${task.processId}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {tasks.map((task) => (
              <Card key={task.taskId}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{task.taskTitle}</span>
                    {getStatusBadge(task.processStatus, task.isResubmission)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Entity:</span>{" "}
                    {task.entityName}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Initiated by:</span>{" "}
                    {task.initiatedBy}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Initiated:</span>{" "}
                    {new Date(task.initiatedDate).toLocaleDateString()}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Days pending:</span>{" "}
                    <span
                      className={
                        task.daysPending > 7
                          ? "text-destructive font-semibold"
                          : ""
                      }
                    >
                      {task.daysPending}{" "}
                      {task.daysPending === 1 ? "day" : "days"}
                    </span>
                  </div>
                  {task.taskDescription && (
                    <div className="text-sm pt-2">
                      <span className="text-muted-foreground">Description:</span>
                      <p className="mt-1">{task.taskDescription}</p>
                    </div>
                  )}
                  <Button asChild className="w-full mt-4">
                    <Link to={`/workflows/processes/${task.processId}`}>
                      View Workflow
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
