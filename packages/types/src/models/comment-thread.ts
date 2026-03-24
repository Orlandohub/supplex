/**
 * Comment Thread Types
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * Types for workflow decline comments and threaded responses
 */

/**
 * Comment entity type enum
 */
export type CommentEntityType = 'form' | 'document';

/**
 * Comment Thread model
 */
export interface CommentThread {
  id: string;
  tenantId: string;
  processInstanceId: string;
  stepInstanceId: string;
  entityType: CommentEntityType;
  entityId?: string | null;
  parentCommentId?: string | null;
  commentText: string;
  commentedBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Comment Thread with user information (for API responses)
 */
export interface CommentThreadWithUser extends CommentThread {
  commentedByUser: {
    id: string;
    name: string;
    email: string;
  };
  replies?: CommentThreadWithUser[];
}

/**
 * Create Comment Thread DTO
 */
export interface CreateCommentThreadDto {
  processInstanceId: string;
  stepInstanceId: string;
  entityType: CommentEntityType;
  entityId?: string;
  parentCommentId?: string;
  commentText: string;
}

/**
 * Update Comment Thread DTO
 */
export interface UpdateCommentThreadDto {
  commentText?: string;
}

