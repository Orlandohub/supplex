import { Elysia } from "elysia";
import { mock } from "bun:test";

/**
 * SUP-21 (9a-4): Global auth bypass for route-level integration tests.
 *
 * The vast majority of route tests in this repo follow the pattern
 *
 *   const app = withApiErrorHandler(
 *     new Elysia()
 *       .derive(() => ({ user: mockUser }))
 *       .use(routeWithAuthenticatedPrefix)
 *   );
 *
 * The test's outer `.derive(...)` is meant to stub the authenticated
 * user, so the route handler receives `mockUser` and exercises the
 * business-logic branch under test (200/forbidden/etc.). However the
 * mounted route does
 *
 *   .use(authenticatedRoute)   // = correlationId + authenticate
 *
 * and `authenticate.derive({ as: "global" }, ...)` requires a valid
 * Bearer token: with no `Authorization` header it correctly throws
 * `Errors.unauthorized("Missing or invalid authorization token",
 * "MISSING_TOKEN")` and the request short-circuits with 401 long
 * before the test's outer `user` derive ever flows into the handler.
 *
 * Up until 9a-4 those tests "passed" only because
 * `apps/api/src/lib/rbac/middleware.test.ts` was registering broad
 * `mock.module(...)` stubs (`../db`, `../logger`, `../jwt-verifier`,
 * `../supabase`, `../auth-cache`) which Bun could not tear down
 * between specs, so the leaked mocks coincidentally short-circuited
 * the auth check for every downstream integration test in the same
 * `bun test` process.
 *
 * Per-file isolation (`apps/api/scripts/test-ci.ts`) plugs that leak.
 * The portable replacement is to mock the `route-plugins` module here
 * — `bunfig.toml` preloads `./src/test-server.ts` before every spec
 * file's top-level code, and Bun honours `mock.module(...)` calls
 * from preloads as defaults that apply to the whole process. The
 * stub keeps `requestLogger` and `correlationId` populated so route
 * handlers that destructure them do not crash, and explicitly does
 * NOT inject a `user` so the test's outer `.derive(() => ({ user }))`
 * remains the source of truth.
 *
 * Tests that need to exercise the REAL `authenticate` plugin (e.g.
 * `apps/api/src/lib/rbac/middleware.test.ts`) bypass this stub by
 * importing the underlying module directly (`../middleware`) — they
 * never resolve `route-plugins`, so this mock is invisible to them.
 *
 * `correlationId` is similarly stubbed for the small number of route
 * tests that mount it directly.
 */
interface StubLogger {
  trace: () => void;
  debug: () => void;
  info: () => void;
  warn: () => void;
  error: () => void;
  fatal: () => void;
  silent: () => void;
  bindings: () => Record<string, unknown>;
  level: string;
  child: () => StubLogger;
}

const stubLogger: StubLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  silent: () => {},
  bindings: () => ({}),
  level: "silent",
  child: () => stubLogger,
};

const stubAuthenticatedRoute = new Elysia({
  name: "authenticated-route",
}).derive({ as: "global" }, () => ({
  requestLogger: stubLogger,
  correlationId: "test-correlation-id",
}));

// SUP-21 (9a-4): Mock only `route-plugins`, NOT `correlation-id`.
// The correlation-id plugin handles `x-correlation-id` headers and is
// exercised directly by `apps/api/src/lib/__tests__/correlation-id.test.ts`,
// which expects the real onAfterHandle to populate
// `set.headers["x-correlation-id"]`. Routes that go through the
// stubbed `authenticatedRoute` instead get the noop derive above —
// they still receive `requestLogger` and `correlationId` so handler
// destructures continue to work, just without onAfterHandle's
// header propagation (which integration tests don't assert on).
mock.module("./lib/route-plugins", () => ({
  authenticatedRoute: stubAuthenticatedRoute,
}));

const app = new Elysia()
  .get("/", () => ({ message: "Test server working!" }))
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
});
