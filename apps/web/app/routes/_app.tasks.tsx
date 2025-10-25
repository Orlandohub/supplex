import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
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
import { useState } from "react";

interface TaskItem {
  workflowId: string;
  stageId: string;
  supplierId: string;
  supplierName: string;
  initiatedBy: string;
  initiatedDate: string;
  riskScore: number;
  daysPending: number;
  stageNumber: number;
  stageName: string;
}

export const meta: MetaFunction = () => {
  return [
    { title: "My Tasks | Supplex" },
    {
      name: "description",
      content: "Review pending workflow approvals assigned to you.",
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  const { session } = await requireAuth(args);

  // Create Eden Treaty client with auth token
  const token = session?.access_token;
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const client = createEdenTreatyClient(token);

  // Fetch my tasks
  try {
    const response = await client.api.workflows["my-tasks"].get();

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
      token,
    });
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    throw new Response("Failed to load tasks", { status: 500 });
  }
}

export default function MyTasksPage() {
  const { tasks } = useLoaderData<typeof loader>();
  const [filterHighRisk, setFilterHighRisk] = useState(false);

  // Filter tasks based on risk score
  const filteredTasks = filterHighRisk
    ? tasks.filter((task) => task.riskScore >= 7)
    : tasks;

  // Get risk badge variant
  const getRiskBadgeVariant = (
    score: number
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 7) return "destructive";
    if (score >= 4) return "secondary";
    return "default";
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
            Review and approve pending qualification workflows
          </p>
        </div>
        {tasks.length > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {filteredTasks.length} pending
          </Badge>
        )}
      </div>

      {/* Filter */}
      {tasks.length > 0 && (
        <div className="mb-4">
          <Button
            variant={filterHighRisk ? "default" : "outline"}
            onClick={() => setFilterHighRisk(!filterHighRisk)}
            size="sm"
          >
            {filterHighRisk ? "Show All" : "High Risk Only"}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Pending Reviews</h2>
            <p className="text-muted-foreground text-center max-w-md">
              You don&apos;t have any workflows awaiting your review at this
              time. New tasks will appear here when suppliers submit
              qualification workflows.
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
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.workflowId}>
                      <TableCell className="font-medium">
                        {task.supplierName}
                      </TableCell>
                      <TableCell>{task.initiatedBy}</TableCell>
                      <TableCell>
                        {new Date(task.initiatedDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRiskBadgeVariant(task.riskScore)}>
                          {task.riskScore.toFixed(1)}
                        </Badge>
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
                          <Link to={`/workflows/${task.workflowId}/review`}>
                            Review
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
            {filteredTasks.map((task) => (
              <Card key={task.workflowId}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>{task.supplierName}</span>
                    <Badge variant={getRiskBadgeVariant(task.riskScore)}>
                      {task.riskScore.toFixed(1)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Submitted by:</span>{" "}
                    {task.initiatedBy}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Submitted:</span>{" "}
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
                  <Button asChild className="w-full mt-4">
                    <Link to={`/workflows/${task.workflowId}/review`}>
                      Review Workflow
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
