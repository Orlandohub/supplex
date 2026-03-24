/**
 * Task Instance Types
 * Types for runtime task execution driven by workflow steps
 * Used by task_instance table
 * 
 * Note: TaskTemplate has been removed as of Story 2.2.5.1
 * Tasks are now created at runtime when step_instance becomes active
 */

/**
 * Task Assignee Type Enum
 * Defines how a task is assigned (to a role or specific user)
 */
export enum TaskAssigneeType {
  ROLE = "role",
  USER = "user",
}

/**
 * Task Instance Status Enum
 * Represents the current state of a runtime task
 */
export enum TaskInstanceStatus {
  PENDING = "pending",
  COMPLETED = "completed",
}

/**
 * Task Instance Interface
 * Runtime execution of a task within a workflow step
 * Created when step_instance transitions to active
 */
export interface TaskInstance {
  id: string;
  tenantId: string;
  processInstanceId: string;
  stepInstanceId: string; // NOT NULL - always linked to a step
  title: string; // Runtime title from workflow step config
  description: string | null; // Runtime description from workflow step config
  assigneeType: TaskAssigneeType; // 'role' or 'user'
  assigneeRole: string | null; // Role name if assigneeType = 'role'
  assigneeUserId: string | null; // User ID if assigneeType = 'user'
  completionTimeDays: number | null; // Days to complete (from workflow step config)
  dueAt: Date | null; // Calculated due date
  status: TaskInstanceStatus; // 'pending' | 'completed'
  completedBy: string | null; // User ID who completed the task
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Task Instance With Details Interface
 * Task instance with assignee, process, and step context
 */
export interface TaskInstanceWithDetails extends TaskInstance {
  assignedUser?: {
    id: string;
    fullName: string;
    email: string;
  };
  completedByUser?: {
    id: string;
    fullName: string;
    email: string;
  };
  processInstance: {
    id: string;
    processType: string;
    entityType: string;
    entityId: string;
  };
  stepInstance: {
    id: string;
    stepName: string;
    stepType: string;
  };
}
