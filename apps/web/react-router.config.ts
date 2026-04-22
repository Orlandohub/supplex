import type { Config } from "@react-router/dev/config";

export default {
  // React Router v7 Framework-mode configuration.
  // Keep the project using Server-Side Rendering (parity with Remix default).
  // Route-file filtering happens inside app/routes.ts via flatRoutes({ ignoredRouteFiles }).
  ssr: true,
} satisfies Config;
