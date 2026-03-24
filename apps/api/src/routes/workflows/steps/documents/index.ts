import { Elysia } from "elysia";
import { listStepDocumentsRoute } from "./list";
import { uploadStepDocumentRoute } from "./upload";
import { reviewStepDocumentsRoute } from "./review";

/**
 * Step Document Routes
 * Aggregated under /api/workflows/steps/:stepId/documents
 */
export const stepDocumentsRoutes = new Elysia()
  .use(listStepDocumentsRoute)
  .use(uploadStepDocumentRoute)
  .use(reviewStepDocumentsRoute);
