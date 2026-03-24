import { Elysia, t } from "elysia";
import { db } from "../../../../lib/db";
import {
  workflowStepDocument,
  stepInstance,
  processInstance,
  documents,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../../lib/rbac/middleware";
import { supabaseAdmin } from "../../../../lib/supabase";
import { randomUUID } from "crypto";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .substring(0, 255);
}

/**
 * POST /api/workflows/steps/:stepId/documents/:requiredDocName/upload
 * Upload a file for a specific required document in a workflow step.
 */
export const uploadStepDocumentRoute = new Elysia()
  .use(authenticate)
  .post(
    "/steps/:stepInstanceId/documents/:requiredDocName/upload",
    async ({ params, body, user, set }) => {
      if (!user?.id || !user?.tenantId) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      const stepId = params.stepInstanceId;
      const { requiredDocName } = params;
      const { file } = body;

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        set.status = 400;
        return {
          success: false,
          error: `File type not supported. Allowed: PDF, Excel, Word, PNG, JPG. Got: ${file.type}`,
        };
      }

      if (file.size > MAX_FILE_SIZE) {
        set.status = 400;
        return {
          success: false,
          error: `File exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        };
      }

      const [step] = await db
        .select()
        .from(stepInstance)
        .where(
          and(
            eq(stepInstance.id, stepId),
            eq(stepInstance.tenantId, user.tenantId)
          )
        );

      if (!step) {
        set.status = 404;
        return { success: false, error: "Step not found" };
      }

      if (step.status !== "active") {
        set.status = 400;
        return { success: false, error: "Step is not active" };
      }

      const decodedDocName = decodeURIComponent(requiredDocName);

      const [wsd] = await db
        .select()
        .from(workflowStepDocument)
        .where(
          and(
            eq(workflowStepDocument.stepInstanceId, stepId),
            eq(workflowStepDocument.requiredDocumentName, decodedDocName),
            eq(workflowStepDocument.tenantId, user.tenantId),
            isNull(workflowStepDocument.deletedAt)
          )
        );

      if (!wsd) {
        set.status = 404;
        return {
          success: false,
          error: `Required document "${decodedDocName}" not found for this step`,
        };
      }

      if (wsd.status === "approved") {
        set.status = 400;
        return { success: false, error: "This document has already been approved" };
      }

      const [process] = await db
        .select({ entityId: processInstance.entityId })
        .from(processInstance)
        .where(eq(processInstance.id, step.processInstanceId));

      const supplierId = process?.entityId || "unknown";
      const sanitized = sanitizeFilename(file.name);
      const fileId = randomUUID();
      const storagePath = `${user.tenantId}/${supplierId}/workflows/${step.processInstanceId}/${stepId}/${fileId}_${sanitized}`;

      try {
        const { error: uploadError } = await supabaseAdmin.storage
          .from("supplier-documents")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("[STEP-DOC-UPLOAD] Storage error:", uploadError);
          set.status = 500;
          return { success: false, error: `Upload failed: ${uploadError.message}` };
        }

        const [newDoc] = await db
          .insert(documents)
          .values({
            tenantId: user.tenantId,
            supplierId,
            filename: file.name,
            documentType: "workflow_document",
            storagePath,
            fileSize: file.size,
            mimeType: file.type,
            uploadedBy: user.id,
          })
          .returning();

        const expiryDate = (body as any).expiryDate
          ? new Date((body as any).expiryDate)
          : null;

        await db
          .update(workflowStepDocument)
          .set({
            documentId: newDoc.id,
            status: "uploaded",
            declineComment: null,
            reviewedBy: null,
            reviewedAt: null,
            ...(expiryDate ? { expiryDate } : {}),
            updatedAt: new Date(),
          })
          .where(eq(workflowStepDocument.id, wsd.id));

        return {
          success: true,
          data: {
            workflowStepDocumentId: wsd.id,
            documentId: newDoc.id,
            filename: newDoc.filename,
            mimeType: newDoc.mimeType,
            fileSize: newDoc.fileSize,
            status: "uploaded",
          },
        };
      } catch (error) {
        try {
          await supabaseAdmin.storage
            .from("supplier-documents")
            .remove([storagePath]);
        } catch (_) { /* cleanup best-effort */ }
        throw error;
      }
    },
    {
      params: t.Object({
        stepInstanceId: t.String({ format: "uuid" }),
        requiredDocName: t.String(),
      }),
      body: t.Object({
        file: t.File(),
      }),
    }
  );
