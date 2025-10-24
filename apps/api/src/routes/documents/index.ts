import { Elysia } from "elysia";
import { listDocuments } from "./list";
import { uploadDocument } from "./upload";
import { downloadDocument } from "./download";
import { deleteDocument } from "./delete";

/**
 * Document Management Routes
 *
 * Aggregates all document-related endpoints:
 * - GET /api/suppliers/:supplierId/documents - List documents for a supplier
 * - POST /api/suppliers/:supplierId/documents - Upload document with metadata
 * - GET /api/documents/:id/download - Generate signed URL for download
 * - DELETE /api/documents/:id - Soft delete document
 */
export const documentsRoutes = new Elysia()
  .use(listDocuments)
  .use(uploadDocument)
  .use(downloadDocument)
  .use(deleteDocument);
