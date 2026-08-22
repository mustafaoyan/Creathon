# my-app

PNPM workspace monorepo.

- `apps/api` — Hono backend, Cloudflare Workers üzerinde çalışır. D1 (Drizzle ORM) ve R2 binding'leri hazır.
- `apps/web` — Hono ile serve edilen, Vite tabanlı SSR + React + Shadcn UI (Tailwind v4) frontend. Cloudflare Workers Static Assets ile deploy edilir.
- `packages/` — apps arasında paylaşılacak kod için ayrılmıştır (henüz boş).

## Kurulum

```bash
pnpm install
```

### apps/api

```bash
cd apps/api
wrangler login
wrangler d1 create my-app-db          # dönen database_id'yi wrangler.jsonc'a yaz
wrangler r2 bucket create my-app-bucket
pnpm db:generate                      # drizzle migration dosyalarını üretir
pnpm db:migrate:local                 # local D1'e uygular
pnpm dev                              # http://localhost:8787
```

### apps/web

```bash
cd apps/web
pnpm dev                              # http://localhost:5173
```

Yeni Shadcn bileşeni eklemek için (`apps/web` içinde):

```bash
pnpm dlx shadcn@latest add <component>
```

## Notlar

- `wrangler.jsonc` dosyalarındaki `database_id` ve bucket adları placeholder'dır; kendi Cloudflare hesabınızdaki gerçek kaynaklarla değiştirin.
- `@cloudflare/vite-plugin` ve Tailwind v4 aktif geliştirilen paketlerdir; `pnpm install` sonrası sürüm uyumsuzluğu çıkarsa `pnpm up` ile güncel sürümlere geçin.
- Turborepo eklenmedi; şu an `pnpm -r` ile script'ler apps üzerinde çalıştırılıyor. İleride cache/paralellik gerekirse eklenebilir.
