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

type ViteManifestEntry = { file: string; css?: string[]; isEntry?: boolean };
type ViteManifest = Record<string, ViteManifestEntry>;

const app = new Hono<{ Bindings: Bindings }>();

let cachedManifest: ViteManifest | null = null;

app.all("/api/*", (c) => c.env.API.fetch(c.req.raw));

app.get("*", async (c) => {
  const [user, clientAssets] = await Promise.all([
    fetchSessionUser(c.env.API, c.req.raw),
    resolveClientAssets(c.env.ASSETS, c.req.url),
  ]);

  const stream = await renderToReadableStream(
    <App url={c.req.path} initialUser={user} clientAssets={clientAssets} />,
    { bootstrapModules: [clientAssets.script] },
  );

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

/** In dev, Vite's dev server transforms the literal source path on the fly. In
 * production there is no such path — `vite build` only emits hashed files under
 * /assets — so we read the manifest it wrote to find the real file names. */
async function resolveClientAssets(
  assets: Fetcher,
  requestUrl: string,
): Promise<{ script: string; css: string[] }> {
  if (import.meta.env.DEV) {
    return { script: "/src/client/main.tsx", css: ["/src/styles/globals.css"] };
  }

  if (!cachedManifest) {
    const manifestUrl = new URL("/manifest.json", requestUrl);
    const response = await assets.fetch(new Request(manifestUrl));
    cachedManifest = await response.json<ViteManifest>();
  }

  const entry =
    cachedManifest["src/client/main.tsx"] ??
    Object.values(cachedManifest).find((candidate) => candidate.isEntry);

  if (!entry) throw new Error("client_entry_not_found_in_manifest");

  return { script: `/${entry.file}`, css: (entry.css ?? []).map((file) => `/${file}`) };
}

export default app;
