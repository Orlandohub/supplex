import { type RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

// Keep parity with the Remix file-system routing convention that the rest
// of the app was authored against (flat routes under app/routes/).
export default flatRoutes({
  ignoredRouteFiles: ["**/*.test.{ts,tsx}", "**/__tests__/**"],
}) satisfies RouteConfig;
