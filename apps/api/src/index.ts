import { Hono } from "hono";
import { cors } from "hono/cors";
import { items } from "./routes/items";
import { uploads } from "./routes/uploads";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/items", items);
app.route("/api/uploads", uploads);

export default app;
