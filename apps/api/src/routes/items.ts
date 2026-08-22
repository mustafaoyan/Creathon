import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { Bindings } from "../index";

export const items = new Hono<{ Bindings: Bindings }>();

items.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const rows = await db.select().from(schema.items).all();
  return c.json(rows);
});

items.post("/", async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }

  const db = drizzle(c.env.DB, { schema });
  const [created] = await db
    .insert(schema.items)
    .values({ name: body.name, createdAt: new Date() })
    .returning();

  return c.json(created, 201);
});
