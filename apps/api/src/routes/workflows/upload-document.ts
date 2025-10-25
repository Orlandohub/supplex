import { Elysia, t } from "elysia";
import { db } from "../../lib/db";
import {
  qualificationWorkflows,
  workflowDocuments,
  documents,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { UserRole } from "@supplex/types";
import { supabaseAdmin } from "../../lib/supabase";
import { randomUUID } from "crypto";
import type { RequiredDocumentItem } from "@supplex/types";

// File validation constants
const ALLOWED_MIME_TYPES = [
  "application/pdf", // PDF
  "image/png", // PNG
  "image/jpeg", // JPG/JPEG
  "application/vnd.ms-excel", // Excel (.xls)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // Excel (.xlsx)
  "application/msword", // Word (.doc)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Word (.docx)
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Sanitize filename to prevent path traversal attacks
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .substring(0, 255);
}

/**
 * Validate file type and size
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported. Allowed types: PDF, Excel, Word, PNG, JPG. Received: ${file.type}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 10MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  return { valid: true };
}

/**
 * POST /api/workflows/:workflowId/documents
 * Upload new document or link existing document to workflow
 *
 * Auth: Requires Procurement Manager or Admin role
 * Tenant Scoping: Only works with workflows in user's tenant
 *
 * AC 4, 5, 6, 7, 9: Upload new document or link existing document to checklist item
 */
export const uploadWorkflowDocumentRoute = new Elysia().use(authenticate).post(
  "/:workflowId/documents",
  async ({ params, body, user, set }) => {
    // Check role: Procurement Manager or Admin only (AC 4)
    if (
      !user?.role ||
      ![UserRole.PROCUREMENT_MANAGER, UserRole.ADMIN].includes(user.role)
    ) {
      set.status = 403;
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Access denied. Required role: Procurement Manager or Admin",
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      const tenantId = user.tenantId as string;
      const userId = user.id as string;

      // Verify workflow exists and belongs to tenant
      const workflow = await db.query.qualificationWorkflows.findFirst({
        where: and(
          eq(qualificationWorkflows.id, params.workflowId),
          eq(qualificationWorkflows.tenantId, tenantId),
          isNull(qualificationWorkflows.deletedAt)
        ),
      });

      if (!workflow) {
        set.status = 404;
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Workflow not found",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Validate checklistItemId exists in snapshotted checklist
      const checklistItems = Array.isArray(workflow.snapshotedChecklist)
        ? (workflow.snapshotedChecklist as RequiredDocumentItem[])
        : [];

      const checklistItem = checklistItems.find(
        (item) => item.id === body.checklistItemId
      );

      if (!checklistItem) {
        set.status = 400;
        return {
          success: false,
          error: {
            code: "INVALID_CHECKLIST_ITEM",
            message: "Checklist item ID not found in workflow checklist",
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Option A: Upload new document
      if (body.file) {
        // Validate file
        const validation = validateFile(body.file);
        if (!validation.valid) {
          set.status = 400;
          return {
            success: false,
            error: {
              code: "INVALID_FILE",
              message: validation.error || "File validation failed",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Sanitize filename
        const sanitizedFilename = sanitizeFilename(body.file.name);

        // Generate unique storage path: {tenantId}/{supplierId}/qualification-{workflowId}/{uuid}_{filename}
        const fileId = randomUUID();
        const storagePath = `${tenantId}/${workflow.supplierId}/qualification-${workflow.id}/${fileId}_${sanitizedFilename}`;

        try {
          // Upload file to Supabase Storage
          const { error: uploadError } = await supabaseAdmin.storage
            .from("supplier-documents")
            .upload(storagePath, body.file, {
              contentType: body.file.type,
              upsert: false,
            });

          if (uploadError) {
            console.error("[WORKFLOW UPLOAD] Storage error:", uploadError);
            set.status = 500;
            return {
              success: false,
              error: {
                code: "UPLOAD_FAILED",
                message: `File upload failed: ${uploadError.message}`,
                timestamp: new Date().toISOString(),
              },
            };
          }

          // Create document record
          const [newDocument] = await db
            .insert(documents)
            .values({
              tenantId,
              supplierId: workflow.supplierId,
              filename: body.file.name,
              documentType: body.documentType || "other",
              storagePath,
              fileSize: body.file.size,
              mimeType: body.file.type,
              description: body.description || null,
              expiryDate: null,
              uploadedBy: userId,
            })
            .returning();

          // Update or create workflow_documents record
          const existingWorkflowDoc =
            await db.query.workflowDocuments.findFirst({
              where: and(
                eq(workflowDocuments.workflowId, workflow.id),
                eq(workflowDocuments.checklistItemId, body.checklistItemId),
                isNull(workflowDocuments.deletedAt)
              ),
            });

          if (existingWorkflowDoc) {
            // Update existing record
            await db
              .update(workflowDocuments)
              .set({
                documentId: newDocument.id,
                status: "Uploaded",
                updatedAt: new Date(),
              })
              .where(eq(workflowDocuments.id, existingWorkflowDoc.id));
          } else {
            // Create new record
            await db.insert(workflowDocuments).values({
              workflowId: workflow.id,
              checklistItemId: body.checklistItemId,
              documentId: newDocument.id,
              status: "Uploaded",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          set.status = 201;
          return {
            success: true,
            data: {
              document: newDocument,
            },
          };
        } catch (error) {
          // Clean up uploaded file if database insert fails
          try {
            await supabaseAdmin.storage
              .from("supplier-documents")
              .remove([storagePath]);
          } catch (cleanupError) {
            console.error("[WORKFLOW UPLOAD] Cleanup failed:", cleanupError);
          }
          throw error;
        }
      }

      // Option B: Link existing document
      if (body.documentId) {
        // Verify document belongs to same supplier and tenant
        const existingDoc = await db.query.documents.findFirst({
          where: and(
            eq(documents.id, body.documentId),
            eq(documents.supplierId, workflow.supplierId),
            eq(documents.tenantId, tenantId),
            isNull(documents.deletedAt)
          ),
        });

        if (!existingDoc) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: "DOCUMENT_NOT_FOUND",
              message: "Document not found or does not belong to supplier",
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Update or create workflow_documents record
        const existingWorkflowDoc = await db.query.workflowDocuments.findFirst({
          where: and(
            eq(workflowDocuments.workflowId, workflow.id),
            eq(workflowDocuments.checklistItemId, body.checklistItemId),
            isNull(workflowDocuments.deletedAt)
          ),
        });

        if (existingWorkflowDoc) {
          // Update existing record
          await db
            .update(workflowDocuments)
            .set({
              documentId: body.documentId,
              status: "Uploaded",
              updatedAt: new Date(),
            })
            .where(eq(workflowDocuments.id, existingWorkflowDoc.id));
        } else {
          // Create new record
          await db.insert(workflowDocuments).values({
            workflowId: workflow.id,
            checklistItemId: body.checklistItemId,
            documentId: body.documentId,
            status: "Uploaded",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return {
          success: true,
          data: {
            document: existingDoc,
          },
        };
      }

      // Neither file nor documentId provided
      set.status = 400;
      return {
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Must provide either file or documentId",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: unknown) {
      console.error("Error uploading workflow document:", error);
      set.status = 500;
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to upload workflow document",
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
  {
    params: t.Object({
      workflowId: t.String({ format: "uuid" }),
    }),
    body: t.Object({
      checklistItemId: t.String({ format: "uuid" }),
      file: t.Optional(
        t.File({
          type: ALLOWED_MIME_TYPES,
          maxSize: MAX_FILE_SIZE,
        })
      ),
      documentId: t.Optional(t.String({ format: "uuid" })),
      documentType: t.Optional(
        t.Union([
          t.Literal("certificate"),
          t.Literal("contract"),
          t.Literal("insurance"),
          t.Literal("audit_report"),
          t.Literal("other"),
        ])
      ),
      description: t.Optional(t.String()),
    }),
    detail: {
      summary: "Upload or link document to workflow",
      description:
        "Upload new document or link existing document to a workflow checklist item (Procurement Manager/Admin only)",
      tags: ["Workflows"],
    },
  }
);
