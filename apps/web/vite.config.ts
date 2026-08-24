import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";

export default defineConfig({
  environments: {
    // Named "manifest.json" (not the default ".vite/manifest.json") so it isn't
    // treated as a dotfile by anything that skips hidden paths when uploading assets.
    client: { build: { manifest: "manifest.json" } },
  },
  plugins: [
    react(),
    tailwindcss(),
    // rubrix-api runs as an auxiliary worker in the same Miniflare instance so the
    // API service binding (see wrangler.jsonc) resolves in `vite dev`, not just when deployed.
    cloudflare({ auxiliaryWorkers: [{ configPath: "../api/wrangler.jsonc" }] }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
