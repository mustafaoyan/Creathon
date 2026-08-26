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

app.all("/api/*", (c) => c.env.API.fetch(c.req.raw));

// `assets.run_worker_first` (wrangler.jsonc) sends every request through this
// worker before Cloudflare's static file serving — required so our own SSR
// handler owns "/" (a static index.html would otherwise shadow it). That means
// real static files (JS/CSS/manifest/public/*) now have to be resolved here
// ourselves: try ASSETS first and use it on a hit, except for "/" itself, which
// must always render through SSR rather than serving the literal index.html.
app.get("*", async (c) => {
  const url = new URL(c.req.url);

  if (url.pathname !== "/") {
    const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }
  }

  const [user, clientAssets] = await Promise.all([
    fetchSessionUser(c.env.API, c.req.raw),
    resolveClientAssets(c.env.ASSETS, c.req.url),
  ]);

  // Post-login, "/" isn't itself a screen — bütün roller aynı yere, ortak
  // "Hoş Geldiniz" ekranına gider (bilinçli olarak role-özel doğrudan sayfaya
  // atmaktan vazgeçildi — gerçek işlevler artık Sidebar'da/3 çizgide,
  // giriş sonrası ilk gördükleri şey sade ve tutarlı olsun diye).
  if (url.pathname === "/" && user?.status === "active" && user.role) {
    return c.redirect("/welcome", 302);
  }

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
 * /assets — so we read the manifest it wrote to find the real file names.
 *
 * ÖNEMLİ: bu manifest ARTIK modül seviyesinde cache'lenmiyor (bir zamanlar
 * `let cachedManifest` vardı) — gerçek bir prod bug'ıydı: bir Worker isolate
 * ayakta kaldığı sürece manifest'i sadece İLK istekte okuyup sonsuza kadar
 * bellekte tutuyordu, bu yüzden yeni bir deploy sonrası hâlâ SICAK olan bir
 * isolate eski JS/CSS dosya adlarını göstermeye devam ediyordu — birkaç
 * deploy boyunca gerçek kullanıcılar eski sürümü görmüş olabilir (kullanıcı
 * testinde bulundu: yeni özellikler prod'da yoktu). Her istekte taze okumak
 * (küçük bir JSON dosyası, maliyeti önemsiz) bu tutarsızlığı kökten kapatıyor. */
async function resolveClientAssets(
  assets: Fetcher,
  requestUrl: string,
): Promise<{ script: string; css: string[] }> {
  if (import.meta.env.DEV) {
    return { script: "/src/client/main.tsx", css: ["/src/styles/globals.css"] };
  }

  const manifestUrl = new URL("/manifest.json", requestUrl);
  const response = await assets.fetch(new Request(manifestUrl));
  const manifest = await response.json<ViteManifest>();

  const entry =
    manifest["src/client/main.tsx"] ?? Object.values(manifest).find((candidate) => candidate.isEntry);

  if (!entry) throw new Error("client_entry_not_found_in_manifest");

  return { script: `/${entry.file}`, css: (entry.css ?? []).map((file) => `/${file}`) };
}

export default app;
