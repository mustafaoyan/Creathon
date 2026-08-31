# RubriX

Yapay Zekâ Destekli Ölçme ve Değerlendirme Sistemi — TEKNOFEST T3 Vakfı için geliştiriliyor.
Kaynak metinden RAG ile soru üretir, açık uçlu yanıtları rubrik bazlı AI ile ön-değerlendirip
nihai kararı her zaman bir insana (eğitmene) bırakan bir sınav platformu.

**Canlı:** [app.hititai.com](https://app.hititai.com)

Mimari kararlar, rol bazlı yetkilendirme kuralları, bilinen tuzaklar ve daha fazlası için
[`CLAUDE.md`](./CLAUDE.md) dosyasına bakın — bu README kuruluma odaklanır.

## Teknoloji Yığını

- **Monorepo:** pnpm workspace (`apps/*`, `packages/*`)
- **Backend (`apps/api`):** Hono, Cloudflare Workers. D1 (Drizzle ORM), R2, Vectorize
  (embedding arama), Workers AI (soru üretimi + rubrik bazlı puanlama), Cloudflare Queues
  (asenkron PDF işleme + soru üretimi)
- **Frontend (`apps/web`):** Hono ile serve edilen Vite SSR + React 19 + Shadcn UI + Tailwind v4
- **Auth:** Google OAuth, sunucu tarafı session (D1 `sessions` tablosu, `httpOnly` cookie)
- **Paylaşılan:** `packages/shared-types` — RBAC rolleri ve DTO'lar hem API hem web tarafından
  buradan içe aktarılıyor

## Roller

`content_creator` (İçerik Uzmanı), `instructor` (Eğitmen), `student` (Öğrenci),
`admin` (Eğitim Yöneticisi) — 4 izole rol. Admin, diğer rollerin ekranlarını tam yetkiyle
gezebiliyor ("Rol Görünümleri"). Detay: `CLAUDE.md` → "Rol Bazlı Yetkilendirme (RBAC)".

## Kurulum

```bash
pnpm install
```

### apps/api

```bash
cd apps/api
wrangler login
wrangler d1 create rubrix-db                    # dönen database_id'yi wrangler.jsonc'a yaz
wrangler r2 bucket create rubrix-documents
wrangler vectorize create rubrix-embeddings --dimensions=1024 --metric=cosine
wrangler queues create rubrix-doc-processing
wrangler queues create rubrix-question-generation
cp .dev.vars.example .dev.vars                  # GOOGLE_CLIENT_SECRET vb. gerçek değerlerle doldur
pnpm db:generate                                # drizzle migration dosyalarını üretir
pnpm db:migrate:local                           # local D1'e uygular
pnpm dev                                        # http://localhost:8787
```

### apps/web

```bash
pnpm --filter @rubrix/web dev                   # http://localhost:5173 — apps/api'yi de
                                                 # service binding ile ayağa kaldırır
```

Yeni Shadcn bileşeni eklemek için (`apps/web` içinde):

```bash
pnpm dlx shadcn@latest add <component>
```

### Diğer script'ler (kök dizinden)

```bash
pnpm typecheck           # apps/api ve apps/web
pnpm build
pnpm db:migrate:remote    # apps/api içinde: prod D1'e uygula
```

## Deploy

```bash
pnpm --filter @rubrix/api typecheck && pnpm --filter @rubrix/web typecheck   # ikisi de temiz olmalı
cd apps/api && wrangler deploy --minify        # önce api
cd apps/web && pnpm build && wrangler deploy   # sonra web (api'yi service binding ile çağırıyor)
```

## Notlar

- `wrangler.jsonc` dosyalarındaki `database_id` placeholder'dır; kendi Cloudflare hesabınızdaki
  gerçek kaynaklarla değiştirin. Bucket/index/queue adları yukarıdaki komutlarla birebir eşleşir.
- `.dev.vars.example` dosyalarını `.dev.vars` olarak kopyalayıp gerçek secret'ları
  (`GOOGLE_CLIENT_SECRET`, vb.) girmeden Google login ve AI özellikleri çalışmaz.
- Turborepo eklenmedi; `pnpm -r` ile script'ler apps üzerinde çalıştırılıyor.
