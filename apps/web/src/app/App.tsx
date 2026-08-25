import { RoleGuardedLayout } from "@/components/layout/RoleGuardedLayout";
import { HomePage } from "@/features/home/HomePage";
import { ToastContainer } from "@/components/ui/toast-container";
import { resolveRoute } from "./router";
import type { SessionUser } from "@/lib/auth-client";

export function App({
  url,
  initialUser,
  clientAssets,
}: {
  url: string;
  initialUser: SessionUser | null;
  /** Resolved once per request in worker/index.tsx — literal `/src/...` paths in dev
   * (Vite's dev server transforms them), hashed `/assets/...` paths in production
   * (read from the built manifest, since `vite build` never emits the source paths). */
  clientAssets: { script: string; css: string[] };
}) {
  const route = resolveRoute(url);
  const Page = route?.component;
  const isHome = url === "/";

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RubriX</title>
        {clientAssets.css.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <script
          // Hydration needs the exact same user + asset paths the server rendered with.
          dangerouslySetInnerHTML={{
            __html: `window.__INITIAL_USER__ = ${JSON.stringify(initialUser)}; window.__CLIENT_ASSETS__ = ${JSON.stringify(clientAssets)};`,
          }}
        />
      </head>
      <body>
        <div id="root">
          {isHome ? (
            <HomePage user={initialUser} />
          ) : (
            <RoleGuardedLayout user={initialUser} requiredRoles={route?.roles ?? []}>
              {Page ? <Page /> : <NotFound />}
            </RoleGuardedLayout>
          )}
        </div>
        <ToastContainer />
      </body>
    </html>
  );
}

function NotFound() {
  return <p className="p-8 text-muted-foreground">Sayfa bulunamadı.</p>;
}
