import { Elysia, t } from "elysia";
import { db } from "../../../../lib/db";
import { documents } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticate } from "../../../../lib/rbac/middleware";
import { supabaseAdmin } from "../../../../lib/supabase";

/**
 * GET /api/documents/:id/view
 * Returns a signed URL for viewing/downloading a document.
 */
export const viewDocumentRoute = new Elysia({ prefix: "/api" })
  .use(authenticate)
  .get(
    "/documents/:id/view",
    async ({ params, user, set }) => {
      if (!user?.id || !user?.tenantId) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      const [doc] = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, params.id),
            eq(documents.tenantId, user.tenantId),
            isNull(documents.deletedAt)
          )
        )
        .limit(1);

      if (!doc) {
        set.status = 404;
        return { success: false, error: "Document not found" };
      }

      const { data, error } = await supabaseAdmin.storage
        .from("supplier-documents")
        .createSignedUrl(doc.storagePath, 300);

      if (error || !data) {
        console.error("[DOC-VIEW] Signed URL error:", error);
        set.status = 500;
        return { success: false, error: "Failed to generate view URL" };
      }

      return {
        success: true,
        data: {
          url: data.signedUrl,
          filename: doc.filename,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
        },
      };
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    }
  );
