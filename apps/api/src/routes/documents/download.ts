import { Elysia, t } from "elysia";
import { db, documents } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../lib/rbac/middleware";
import { supabaseAdmin } from "../../lib/supabase";

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
    async ({ params, user, set }) => {
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
        set.status = 404;
        throw new Error("Document not found or does not belong to your tenant");
      }

      try {
        // Generate signed URL valid for 5 minutes (300 seconds)
        const { data: signedUrlData, error: signedUrlError } =
          await supabaseAdmin.storage
            .from("supplier-documents")
            .createSignedUrl(document.storagePath, 300);

        if (signedUrlError || !signedUrlData) {
          console.error(
            "[DOWNLOAD] Signed URL generation error:",
            signedUrlError
          );
          set.status = 500;
          throw new Error(
            `Failed to generate download URL: ${signedUrlError?.message || "Unknown error"}`
          );
        }

        return {
          url: signedUrlData.signedUrl,
          filename: document.filename,
          mimeType: document.mimeType,
        };
      } catch (error) {
        console.error("[DOWNLOAD] Error:", error);
        set.status = 500;
        throw new Error("Failed to generate download URL");
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    }
  );
