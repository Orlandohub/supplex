import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { registerRoute } from "./routes/auth/register";

const app = new Elysia()
  .use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }))
  .get("/", () => ({
    message: "Supplex API",
    version: "1.0.0",
    status: "healthy",
  }))
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .group("/api", (app) =>
    app
      .use(registerRoute)
  );

const PORT = process.env.PORT || 3001;

if (import.meta.main) {
  app.listen(PORT);
  console.error(`🦊 Supplex API is running at http://localhost:${PORT}`);
}

export default app;
export type App = typeof app;
