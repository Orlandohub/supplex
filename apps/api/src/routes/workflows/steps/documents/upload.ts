import { Elysia, t } from "elysia";
import { db } from "../../../../lib/db";
import {
  workflowStepDocument,
  stepInstance,
  processInstance,
  documents,
} from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { DocumentType } from "@supplex/types";
import { authenticatedRoute } from "../../../../lib/route-plugins";
import { verifyStepProcessAccess } from "../../../../lib/rbac/entity-authorization";
import { validateFileMagicBytes } from "../../../../lib/file-validation";
import { supabaseAdmin } from "../../../../lib/supabase";
import { ApiError, Errors } from "../../../../lib/errors";
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
  .use(authenticatedRoute)
  .post(
    "/steps/:stepInstanceId/documents/:requiredDocName/upload",
    async ({ params, body, user, requestLogger }) => {
      if (!user?.id || !user?.tenantId) {
        throw Errors.unauthorized("Unauthorized");
      }

      const stepId = params.stepInstanceId;
      const { requiredDocName } = params;
      const { file } = body;

      const access = await verifyStepProcessAccess(user, stepId, db);
      if (!access.allowed) {
        throw Errors.forbidden("Access denied");
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw Errors.badRequest(
          `File type not supported. Allowed: PDF, Excel, Word, PNG, JPG. Got: ${file.type}`
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        throw Errors.badRequest(
          `File exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`
        );
      }

      // Magic-byte validation (server-side content inspection)
      const magicValidation = await validateFileMagicBytes(file);
      if (!magicValidation.valid) {
        throw Errors.badRequest(
          magicValidation.error ||
            "File type validation failed: detected type does not match declared Content-Type"
        );
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
        throw Errors.notFound("Step not found");
      }

      if (step.status !== "active") {
        throw Errors.badRequest("Step is not active");
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
        throw Errors.notFound(
          `Required document "${decodedDocName}" not found for this step`
        );
      }

      if (wsd.status === "approved") {
        throw Errors.badRequest("This document has already been approved");
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
          requestLogger.error(
            { err: uploadError },
            "step document upload storage error"
          );
          throw Errors.internal(`Upload failed: ${uploadError.message}`);
        }

        const [newDoc] = await db
          .insert(documents)
          .values({
            tenantId: user.tenantId,
            supplierId,
            filename: file.name,
            documentType: DocumentType.WORKFLOW_DOCUMENT,
            storagePath,
            fileSize: file.size,
            mimeType: file.type,
            uploadedBy: user.id,
          })
          .returning();

        if (!newDoc) throw new Error("Failed to create document record");

        const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;

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
        if (error instanceof ApiError) throw error;
        try {
          await supabaseAdmin.storage
            .from("supplier-documents")
            .remove([storagePath]);
        } catch (_) {
          /* cleanup best-effort */
        }
        throw Errors.internal("Document upload failed unexpectedly");
      }
    },
    {
      params: t.Object({
        stepInstanceId: t.String({ format: "uuid" }),
        requiredDocName: t.String(),
      }),
      body: t.Object({
        file: t.File(),
        expiryDate: t.Optional(t.String()),
      }),
    }
  );
