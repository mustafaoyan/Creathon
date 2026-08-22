import { Hono } from "hono";
import type { Bindings } from "../index";

export const uploads = new Hono<{ Bindings: Bindings }>();

uploads.post("/", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!(file instanceof File)) {
    return c.json({ error: "file is required" }, 400);
  }

  const key = `uploads/${crypto.randomUUID()}-${file.name}`;
  await c.env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return c.json({ key }, 201);
});

uploads.get("/:key{.+}", async (c) => {
  const object = await c.env.BUCKET.get(c.req.param("key"));
  if (!object) {
    return c.notFound();
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
    },
  });
});
