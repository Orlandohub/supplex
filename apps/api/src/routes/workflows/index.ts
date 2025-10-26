import { Elysia } from "elysia";
import { initiateWorkflowRoute } from "./initiate";
import { supplierWorkflowsRoute } from "./supplier-workflows";
import { workflowDetailRoute } from "./detail";
import { workflowDocumentsRoute } from "./documents";
import { uploadWorkflowDocumentRoute } from "./upload-document";
import { removeWorkflowDocumentRoute } from "./remove-document";
import { submitRoute } from "./submit";
import { completionStatusRoute } from "./completion-status";
import { assignedReviewerRoute } from "./assigned-reviewer";
import { myTasksRoute } from "./my-tasks";
import { myTasksCountRoute } from "./my-tasks-count";
import { reviewRoute } from "./review";
import { approveStageRoute } from "./approve-stage";
import { rejectStageRoute } from "./reject-stage";
import { workflowHistoryRoute } from "./history";
import { listQualificationsRoute } from "./list-qualifications";
import { exportQualificationsRoute } from "./export-qualifications";

/**
 * Workflow Routes
 * Aggregates all workflow-related API endpoints
 *
 * Routes:
 * - POST /api/workflows/initiate - Initiate a new qualification workflow
 * - GET /api/workflows/qualifications - List all qualification workflows with filtering
 * - GET /api/workflows/qualifications/export - Export workflows to CSV
 * - GET /api/workflows/supplier/:supplierId - Get workflows for a supplier
 * - GET /api/workflows/:workflowId - Get workflow details with supplier and checklist
 * - GET /api/workflows/:workflowId/documents - Get all workflow documents
 * - POST /api/workflows/:workflowId/documents - Upload or link document to workflow
 * - DELETE /api/workflows/:workflowId/documents/:documentId - Remove document from workflow
 * - GET /api/workflows/:workflowId/completion-status - Get workflow document completion status
 * - GET /api/workflows/:workflowId/assigned-reviewer - Get assigned reviewer for workflow submission
 * - POST /api/workflows/:workflowId/submit - Submit workflow for Stage 1 approval
 * - GET /api/workflows/my-tasks - Get list of pending tasks for current user
 * - GET /api/workflows/my-tasks/count - Get count of pending tasks for badge
 * - GET /api/workflows/:workflowId/review - Get workflow review page data
 * - POST /api/workflows/:workflowId/stages/:stageId/approve - Approve a workflow stage
 * - POST /api/workflows/:workflowId/stages/:stageId/reject - Reject a workflow stage
 * - GET /api/workflows/:workflowId/history - Get workflow history with all stages
 */
export const workflowsRoutes = new Elysia({ prefix: "/api/workflows" })
  // Static routes first (before dynamic routes)
  // More specific routes before less specific ones
  .use(initiateWorkflowRoute)
  .use(exportQualificationsRoute) // /qualifications/export (more specific)
  .use(listQualificationsRoute) // /qualifications (less specific)
  .use(myTasksCountRoute) // /my-tasks/count (more specific)
  .use(myTasksRoute) // /my-tasks (less specific)
  // Dynamic routes after (to avoid matching static routes)
  .use(supplierWorkflowsRoute)
  .use(workflowDetailRoute)
  .use(workflowDocumentsRoute)
  .use(uploadWorkflowDocumentRoute)
  .use(removeWorkflowDocumentRoute)
  .use(completionStatusRoute)
  .use(assignedReviewerRoute)
  .use(submitRoute)
  .use(reviewRoute)
  .use(approveStageRoute)
  .use(rejectStageRoute)
  .use(workflowHistoryRoute);
