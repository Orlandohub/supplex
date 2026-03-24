/**
 * Comment Thread View Component
 * Story: 2.2.8 - Workflow Execution Engine
 * 
 * Displays and manages comment threads for workflow processes
 */

import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { createEdenTreatyClient } from "~/lib/api-client";
import { useNavigate } from "@remix-run/react";

interface CommentThread {
  id: string;
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

interface StepInfo {
  id: string;
  stepName: string;
  stepOrder: number;
}

interface CommentThreadViewProps {
  processId: string;
  comments: CommentThread[];
  token: string;
  steps?: StepInfo[];
  activeStepId?: string;
}

export function CommentThreadView({
  processId,
  comments,
  token,
  steps = [],
  activeStepId,
}: CommentThreadViewProps) {
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = createEdenTreatyClient(token);

  const stepNameMap = new Map(steps.map((s) => [s.id, s.stepName]));

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      setError("Comment cannot be empty");
      return;
    }

    const stepId = activeStepId || steps[0]?.id;
    if (!stepId) {
      setError("No active step to attach the comment to");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await client.api.workflows.comments.post({
        processInstanceId: processId,
        stepInstanceId: stepId,
        entityType: "form",
        commentText: newComment.trim(),
      });

      if (response.error) {
        setError((response.error as any).message || "Failed to add comment");
        return;
      }

      setNewComment("");
      navigate(".", { replace: true });
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error adding comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group comments by step, then sort each group newest-first
  const commentsByStep = comments.reduce((acc, comment) => {
    const key = comment.stepInstanceId || "general";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(comment);
    return acc;
  }, {} as Record<string, CommentThread[]>);

  for (const group of Object.values(commentsByStep)) {
    group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return (
    <div className="space-y-6">
      {/* Add New Comment */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Add Comment</h3>
        
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write your comment here..."
          className="w-full min-h-[100px] p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSubmitting}
        />

        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSubmitComment}
            disabled={isSubmitting || !newComment.trim()}
          >
            {isSubmitting ? "Posting..." : "Post Comment"}
          </Button>
        </div>
      </Card>

      {/* Display Comments */}
      {Object.keys(commentsByStep).length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-gray-500">No comments yet</p>
        </Card>
      ) : (
        Object.entries(commentsByStep).map(([stepId, stepComments]) => (
          <Card key={stepId} className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              {stepId === "general"
                ? "General Comments"
                : stepNameMap.get(stepId) || "Step Comments"}
            </h3>

            <div className="space-y-4">
              {stepComments.map((comment) => (
                <div
                  key={comment.id}
                  className="border-l-4 border-blue-500 pl-4 py-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {comment.commenterFullName || comment.commenterEmail || "Unknown User"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                    {comment.commentText}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

