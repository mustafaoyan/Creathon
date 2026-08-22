import { RoleGuardedLayout } from "@/components/layout/RoleGuardedLayout";
import { resolveRoute } from "./router";
import type { SessionUser } from "@/lib/auth-client";

export function App({ url, initialUser }: { url: string; initialUser: SessionUser | null }) {
  const route = resolveRoute(url);
  const Page = route?.component;

  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RubriX</title>
        <link rel="stylesheet" href="/src/styles/globals.css" />
        <script
          // Hydration needs the exact same user object the server rendered with.
          dangerouslySetInnerHTML={{ __html: `window.__INITIAL_USER__ = ${JSON.stringify(initialUser)};` }}
        />
      </head>
      <body>
        <div id="root">
          <RoleGuardedLayout user={initialUser} requiredRoles={route?.roles ?? []}>
            {Page ? <Page /> : <NotFound />}
          </RoleGuardedLayout>
        </div>
      </body>
    </html>
  );
}

function NotFound() {
  return <p className="p-8 text-muted-foreground">Sayfa bulunamadı.</p>;
}
