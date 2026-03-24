import { Elysia } from "elysia";
import { createDraftRoute } from "./create-draft";
import { submitRoute } from "./submit";
import { getSubmissionRoute } from "./get";
import { listSubmissionsRoute } from "./list";
import { bySupplierRoute } from "./by-supplier";

/**
 * Form Submissions Route Aggregator
 * Story: 2.2.4 - Form Runtime Execution with Save Draft
 * Updated: 2.2.16 - Added by-supplier endpoint
 *
 * Registers all form submission routes with /api/form-submissions prefix
 *
 * CRITICAL: Following ElysiaJS route organization pattern:
 * - ONLY this parent aggregator has a prefix
 * - Child routes must NOT have prefixes (parent provides them)
 *
 * Routes:
 * - POST   /api/form-submissions/draft                        - Create/update draft submission
 * - POST   /api/form-submissions/:submissionId/submit         - Submit form
 * - GET    /api/form-submissions/:submissionId                - Get submission with answers
 * - GET    /api/form-submissions                              - List user's submissions
 * - GET    /api/form-submissions/by-supplier/:supplierId      - List supplier's form submissions
 */
export const formSubmissionsRoutes = new Elysia({
  prefix: "/api/form-submissions",
})
  .use(bySupplierRoute)
  .use(createDraftRoute)
  .use(submitRoute)
  .use(getSubmissionRoute)
  .use(listSubmissionsRoute);

