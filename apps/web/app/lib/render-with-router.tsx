/**
 * `renderWithRouter` — render a component inside a React Router v7 data
 * router for unit tests.
 *
 * Plain `<MemoryRouter>` / `<BrowserRouter>` are *not* data routers, so
 * components that call `useRouteLoaderData`, `useFetcher`,
 * `useNavigation`, or `useNavigate` throw
 * `"… must be used within a data router"` when rendered inside them.
 *
 * This helper builds a minimal `createMemoryRouter` tree with one route
 * carrying `id: "routes/_app"` (matching the production root layout id),
 * pre-hydrates that route's loader data with `appLoaderData`, and mounts
 * the supplied element under it. Components that read
 * `useRouteLoaderData("routes/_app")` resolve against `appLoaderData`
 * synchronously (no async loader pass), so tests can assert on rendered
 * output without `waitFor`.
 *
 * Tests that mock `useRouteLoaderData` directly via `vi.mock` keep
 * working — the mock takes precedence over the route loader.
 */

import type { ReactElement } from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  type RouteObject,
} from "react-router";

export interface RenderWithRouterOptions
  extends Omit<RenderOptions, "wrapper"> {
  /** Initial URL entries; defaults to `["/"]`. */
  initialEntries?: string[];
  /**
   * Pre-hydrated data for `useRouteLoaderData("routes/_app")` calls
   * inside the rendered tree. Provide the shape your component reads
   * (typically a partial of `AppLoaderData`).
   */
  appLoaderData?: unknown;
  /** Path the rendered element is mounted at. Defaults to `"*"`. */
  path?: string;
  /**
   * Sibling routes if the test exercises `<Link>` navigation to another
   * URL. Each entry is mounted under the same `routes/_app` parent.
   */
  extraRoutes?: RouteObject[];
}

export function renderWithRouter(
  ui: ReactElement,
  options: RenderWithRouterOptions = {}
): RenderResult {
  const {
    initialEntries = ["/"],
    appLoaderData = null,
    path = "*",
    extraRoutes = [],
    ...renderOptions
  } = options;

  // When `extraRoutes` is supplied we nest them under a layout route that
  // owns the `routes/_app` id, so any route in the tree can resolve
  // `useRouteLoaderData("routes/_app")` against `appLoaderData`. When
  // there are no extra routes we keep the flat shape (parent route renders
  // `ui` directly), which avoids relying on `<Outlet />` for the common
  // single-page test case.
  const routes: RouteObject[] =
    extraRoutes.length > 0
      ? [
          {
            id: "routes/_app",
            path: "/",
            element: <Outlet />,
            children: [{ path, element: ui }, ...extraRoutes],
          },
        ]
      : [{ id: "routes/_app", path, element: ui }];

  const router = createMemoryRouter(routes, {
    initialEntries,
    // Pre-hydrate so the data router does not transition through a
    // "loading" state. The route reading `useRouteLoaderData("routes/_app")`
    // resolves against this synchronously.
    hydrationData: {
      loaderData: { "routes/_app": appLoaderData },
    },
  });

  return render(<RouterProvider router={router} />, renderOptions);
}
