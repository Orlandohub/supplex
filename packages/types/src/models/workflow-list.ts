/**
 * Workflow List Types
 *
 * Types for qualification workflow listing, filtering, and pagination
 */

import type { WorkflowStatusType } from "./qualification-workflow";

/**
 * Workflow List Item
 * Represents a single workflow in the list view
 */
export interface WorkflowListItem {
  id: string; // UUID
  supplierName: string; // From joined suppliers table
  supplierId: string;
  status: WorkflowStatusType; // Draft, Stage1, Stage2, Stage3, Approved, Rejected
  currentStage: number; // 0-3
  initiatedBy: string; // User full name from joined users table
  initiatedDate: Date;
  daysInProgress: number; // Calculated: NOW() - initiated_date
  riskScore: number | null; // 0.00-10.00
}

/**
 * Workflow Sort By Options
 */
export enum WorkflowSortBy {
  INITIATED_DATE = "initiated_date",
  DAYS_IN_PROGRESS = "days_in_progress",
  RISK_SCORE = "risk_score",
}

/**
 * Workflow Tab Options
 */
export enum WorkflowTab {
  ALL = "all",
  MY_TASKS = "myTasks",
  MY_INITIATED = "myInitiated",
}

/**
 * Workflow List Filters
 * Query parameters for filtering workflows
 */
export interface WorkflowListFilters {
  status?: string; // All, Draft, InProgress, Approved, Rejected
  stage?: number | string; // All, 1, 2, 3
  riskLevel?: string; // All, Low, Medium, High
  search?: string; // Supplier name search
  sortBy?: WorkflowSortBy;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
  tab?: WorkflowTab; // ALL, MY_TASKS, MY_INITIATED
}

/**
 * Workflow List Response
 * Paginated response for workflow list
 */
export interface WorkflowListResponse {
  workflows: WorkflowListItem[];
  total: number;
  page: number;
  limit: number;
}
