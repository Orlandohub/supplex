import { json } from "@remix-run/node";

/**
 * Frontend Health Check Endpoint
 *
 * Used by monitoring systems (Vercel, Sentry) to verify the frontend application is running.
 * Returns basic health information without checking external dependencies.
 *
 * @returns Health status with timestamp and version
 */
export async function loader() {
  return json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      service: "web",
      environment: process.env.NODE_ENV || "development",
    },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
