import { Hono } from "hono";
import { renderToReadableStream } from "react-dom/server";
import { App } from "@/app/App";
import type { SessionUser } from "@/lib/auth-client";

type Bindings = {
  ASSETS: Fetcher;
  /** Service binding to the rubrix-api Worker — keeps the browser on a single
   * origin so the Google-OAuth session cookie works without cross-site issues. */
  API: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

app.all("/api/*", (c) => c.env.API.fetch(c.req.raw));

app.get("*", async (c) => {
  const user = await fetchSessionUser(c.env.API, c.req.raw);

  const stream = await renderToReadableStream(<App url={c.req.path} initialUser={user} />, {
    bootstrapModules: ["/src/client/main.tsx"],
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

async function fetchSessionUser(api: Fetcher, request: Request): Promise<SessionUser | null> {
  const meUrl = new URL("/api/auth/me", request.url);
  const response = await api.fetch(new Request(meUrl, { headers: request.headers }));
  if (!response.ok) return null;

  const { user } = await response.json<{ user: SessionUser | null }>();
  return user;
}

export default app;
