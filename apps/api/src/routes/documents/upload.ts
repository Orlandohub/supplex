import { Elysia, t } from "elysia";
import { db, documents } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { requirePermission } from "../../lib/rbac/middleware";
import { authenticatedRoute } from "../../lib/route-plugins";
import { PermissionAction } from "@supplex/types";
import { supabaseAdmin } from "../../lib/supabase";
import { validateFileMagicBytes } from "../../lib/file-validation";
import { randomUUID } from "crypto";
import { ApiError, Errors } from "../../lib/errors";

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
 * Removes special characters and path separators
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
    .replace(/\.{2,}/g, ".") // Replace multiple dots with single dot
    .substring(0, 255); // Limit length
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
 * POST /api/suppliers/:id/documents
 * Upload new document with metadata
 *
 * Auth: Requires Admin or Procurement Manager role
 * Tenant Scoping: Automatically sets tenant_id from authenticated user
 */
export const uploadDocument = new Elysia({ prefix: "/api" })
  .use(authenticatedRoute)
  .use(requirePermission(PermissionAction.UPLOAD_DOCUMENTS))
  .post(
    "/suppliers/:id/documents",
    async ({ params, body, user, requestLogger }) => {
      const { id: supplierId } = params;
      const { file, documentType, description, expiryDate } = body;

      // Validate supplier exists and belongs to tenant
      const { suppliers } = await import("@supplex/db");
      const supplier = await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.id, supplierId),
            eq(suppliers.tenantId, user.tenantId),
            isNull(suppliers.deletedAt)
          )
        )
        .limit(1);

      if (supplier.length === 0) {
        throw Errors.notFound(
          "Supplier not found or does not belong to your tenant"
        );
      }

      // Validate file (header-based)
      const validation = validateFile(file);
      if (!validation.valid) {
        throw Errors.badRequest(validation.error!);
      }

      // Magic-byte validation (server-side content inspection)
      const magicValidation = await validateFileMagicBytes(file);
      if (!magicValidation.valid) {
        throw Errors.badRequest(
          magicValidation.error ||
            "File type validation failed: detected type does not match declared Content-Type"
        );
      }

      // Sanitize filename
      const sanitizedFilename = sanitizeFilename(file.name);

      // Generate unique storage path: {tenantId}/{supplierId}/{uuid}_{filename}
      const fileId = randomUUID();
      const storagePath = `${user.tenantId}/${supplierId}/${fileId}_${sanitizedFilename}`;

      // TODO: Integrate virus scanning (e.g., ClamAV) before storing file - Phase 2

      try {
        // Upload file to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from("supplier-documents")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false, // Prevent overwrite
          });

        if (uploadError) {
          requestLogger.error(
            { err: uploadError },
            "Supabase Storage upload error"
          );

          // Handle specific storage errors
          if (uploadError.message.includes("Bucket not found")) {
            throw Errors.internal(
              "Storage bucket not configured. Please contact support."
            );
          }

          if (uploadError.message.includes("quota")) {
            throw new ApiError(
              507,
              "STORAGE_QUOTA_EXCEEDED",
              "Storage quota exceeded. Please contact support."
            );
          }

          throw Errors.internal(`File upload failed: ${uploadError.message}`);
        }

        // Parse expiry date if provided
        const parsedExpiryDate = expiryDate ? new Date(expiryDate) : null;

        // Store document metadata in database
        const [newDocument] = await db
          .insert(documents)
          .values({
            tenantId: user.tenantId,
            supplierId,
            filename: file.name,
            documentType,
            storagePath,
            fileSize: file.size,
            mimeType: file.type,
            description: description || null,
            expiryDate: parsedExpiryDate,
            uploadedBy: user.id,
          })
          .returning();

        return {
          document: newDocument,
        };
      } catch (error) {
        // If database insert fails, attempt to clean up uploaded file
        try {
          await supabaseAdmin.storage
            .from("supplier-documents")
            .remove([storagePath]);
        } catch (cleanupError) {
          requestLogger.error(
            { err: cleanupError },
            "failed to clean up file after error"
          );
        }

        throw error;
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        file: t.File({
          type: ALLOWED_MIME_TYPES,
          maxSize: MAX_FILE_SIZE,
        }),
        documentType: t.Union([
          t.Literal("certificate"),
          t.Literal("contract"),
          t.Literal("insurance"),
          t.Literal("audit_report"),
          t.Literal("other"),
        ]),
        description: t.Optional(t.String()),
        expiryDate: t.Optional(t.String({ format: "date" })),
      }),
    }
  );
