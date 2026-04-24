import { Elysia, t } from "elysia";
import { db, documents } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { verifyDocumentAccess } from "../../lib/rbac/entity-authorization";
import { supabaseAdmin } from "../../lib/supabase";
import { ApiError, Errors } from "../../lib/errors";

/**
 * GET /api/documents/:id/download
 * Generate signed URL for document download
 *
 * Auth: Requires authentication (any role)
 * Tenant Scoping: Only allows download if document belongs to user's tenant
 */
export const downloadDocument = new Elysia({ prefix: "/api" })
  .use(authenticate)
  .get(
    "/documents/:id/download",
    async ({ params, user, requestLogger }: any) => {
      const { id } = params;

      // Fetch document and verify tenant ownership
      const [document] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, id),
            eq(documents.tenantId, user.tenantId),
            isNull(documents.deletedAt)
          )
        )
        .limit(1);

      if (!document) {
        throw Errors.notFound(
          "Document not found or does not belong to your tenant"
        );
      }

      // Entity-level authorization: supplier_user can only download their own documents
      const access = await verifyDocumentAccess(user, document, db);
      if (!access.allowed) {
        throw Errors.forbidden(access.reason || "Access denied");
      }

      try {
        // Generate signed URL valid for 5 minutes (300 seconds)
        const { data: signedUrlData, error: signedUrlError } =
          await supabaseAdmin.storage
            .from("supplier-documents")
            .createSignedUrl(document.storagePath, 300);

        if (signedUrlError || !signedUrlData) {
          requestLogger.error(
            { err: signedUrlError },
            "signed URL generation error"
          );
          throw Errors.internal(
            `Failed to generate download URL: ${signedUrlError?.message || "Unknown error"}`
          );
        }

        return {
          url: signedUrlData.signedUrl,
          filename: document.filename,
          mimeType: document.mimeType,
        };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        requestLogger.error({ err: error }, "error generating download URL");
        throw Errors.internal("Failed to generate download URL");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    }
  );
