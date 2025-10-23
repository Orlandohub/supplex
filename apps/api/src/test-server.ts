import { Elysia } from "elysia";

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
