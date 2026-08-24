import { hydrateRoot } from "react-dom/client";
import { App } from "@/app/App";
import type { SessionUser } from "@/lib/auth-client";
import "@/styles/globals.css";

declare global {
  interface Window {
    __INITIAL_USER__?: SessionUser | null;
    __CLIENT_ASSETS__?: { script: string; css: string[] };
  }
}

hydrateRoot(
  document,
  <App
    url={window.location.pathname}
    initialUser={window.__INITIAL_USER__ ?? null}
    clientAssets={window.__CLIENT_ASSETS__ ?? { script: "/src/client/main.tsx", css: [] }}
  />,
);
