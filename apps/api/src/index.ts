import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(cors())
  .get("/", () => ({
    message: "Supplex API",
    version: "1.0.0",
    status: "healthy",
  }))
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .listen(process.env.PORT || 3001);

console.error(
  `🦊 Supplex API is running at http://${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
