/**
 * Typed Route Plugins
 * SUP-14 sub-task: typed Elysia route context.
 *
 * Composed Elysia plugins that bundle commonly-paired derives so that route
 * handlers get a fully-typed context (no untyped widening required).
 *
 * Background
 * ----------
 * - `correlationId` (lib/correlation-id.ts) decorates the context with
 *   `requestLogger` and `correlationId` via `.derive({ as: "global" }, ...)`.
 *   The plugin is `.use()`d once on the top-level app in `index.ts`. At
 *   runtime its derive runs for every request, but the **type** of that
 *   derive does not propagate into child routes that mount independently
 *   via `.use(authenticate)`. As a result, handlers that destructure
 *   `requestLogger` were previously forced to type the context as `any`.
 * - `authenticate` (lib/rbac/middleware.ts) decorates the context with
 *   `user`. Its types DO propagate forward through the chain, which is why
 *   routes that destructure only `{ user }` already work without an untyped
 *   widening of the context parameter.
 *
 * `authenticatedRoute` re-exposes both derives, so any route that calls
 * `.use(authenticatedRoute)` instead of `.use(authenticate)` sees
 * `{ user, requestLogger, correlationId }` in its handler context, typed
 * end-to-end. There is no runtime overhead: Elysia deduplicates plugins by
 * `name` (`correlation-id`, `auth`), so the derives still execute exactly
 * once per request even though the plugin is composed.
 *
 * Usage
 * -----
 * ```ts
 * import { authenticatedRoute } from "../../lib/route-plugins";
 *
 * export const myRoute = new Elysia()
 *   .use(authenticatedRoute)
 *   .get("/path", async ({ user, requestLogger }) => {
 *     // user: AuthContext["user"], requestLogger: pino.Logger
 *   });
 * ```
 *
 * Routes that need only `{ user }` (no logger) may continue using
 * `.use(authenticate)` directly — they already work with full context typing.
 */

import { Elysia } from "elysia";
import { correlationId } from "./correlation-id";
import { authenticate } from "./rbac/middleware";

export const authenticatedRoute = new Elysia({ name: "authenticated-route" })
  .use(correlationId)
  .use(authenticate);
