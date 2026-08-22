import { defineConfig } from "drizzle-kit";

// Local geliştirme: `pnpm db:migrate:local` wrangler'ın kendi local D1
// (miniflare/sqlite) dosyasını kullanır, bu config sadece migration
// dosyalarını üretmek (db:generate) için gereklidir.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
