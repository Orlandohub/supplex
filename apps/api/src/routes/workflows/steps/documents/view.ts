import { Elysia, t } from "elysia";
import { db } from "../../../../lib/db";
import { documents } from "@supplex/db";
import { eq, and, isNull } from "drizzle-orm";
import { authenticatedRoute } from "../../../../lib/route-plugins";
import { verifyDocumentAccess } from "../../../../lib/rbac/entity-authorization";
import { supabaseAdmin } from "../../../../lib/supabase";
import { Errors } from "../../../../lib/errors";

/**
 * GET /api/documents/:id/view
 * Returns a signed URL for viewing/downloading a document.
 */
export const viewDocumentRoute = new Elysia({ prefix: "/api" })
  .use(authenticatedRoute)
  .get(
    "/documents/:id/view",
    async ({ params, user, requestLogger }) => {
      if (!user?.id || !user?.tenantId) {
        throw Errors.unauthorized("Unauthorized");
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
        throw Errors.notFound("Document not found");
      }

      // Entity-level authorization: supplier_user can only view their own documents
      const access = await verifyDocumentAccess(user, doc, db);
      if (!access.allowed) {
        throw Errors.forbidden(access.reason || "Access denied");
      }

      const { data, error } = await supabaseAdmin.storage
        .from("supplier-documents")
        .createSignedUrl(doc.storagePath, 300);

      if (error || !data) {
        requestLogger.error({ err: error }, "signed URL generation error");
        throw Errors.internal("Failed to generate view URL");
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
