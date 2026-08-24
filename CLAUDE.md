# RubriX

Yapay Zekâ Destekli Ölçme ve Değerlendirme Sistemi — TEKNOFEST T3 Vakfı için geliştiriliyor.
Kaynak metinden RAG ile soru üreten, açık uçlu yanıtları rubrik bazlı AI ile ön-değerlendirip
nihai kararı her zaman bir insana (eğitmene) bırakan bir sınav platformu.

Bu dosya, bu repoda açılan her Claude Code oturumuna otomatik yükleniyor — proje hakkında
konuşma geçmişini bilmeyen biri (başka bir makine, başka biri) buradan hızlıca bağlam kazanır.

## Teknoloji Yığını

- **Monorepo:** pnpm workspace (`apps/*`, `packages/*`), Turborepo yok — sade `pnpm -r` script'leri.
- **Backend (`apps/api`):** Hono, Cloudflare Workers. D1 (SQLite, Drizzle ORM), R2 (dosya depolama),
  Vectorize (embedding arama), Workers AI (`bge-m3` çok dilli embedding), Cloudflare Queues
  (asenkron PDF işleme).
- **Frontend (`apps/web`):** Hono ile serve edilen Vite SSR + React 19 + Shadcn UI + Tailwind v4.
- **Auth:** Google OAuth, sunucu tarafı session (D1 `sessions` tablosu, cookie).
- **AI:** Anthropic Claude, Cloudflare AI Gateway arkasında.
- **Paylaşılan:** `packages/shared-types` — RBAC rolleri ve DTO'lar hem `@rubrix/api` hem
  `@rubrix/web` tarafından buradan içe aktarılıyor.

## Mimari Kararlar (neden böyle kuruldu)

- **Modüler Monolit, mikroservise hazır** — `apps/api/src/modules/*` her biri kendi
  routes/service/repository katmanına sahip, bağımsız bir Worker'a ayrılabilecek kadar izole.
  Gerçek çoklu-Worker mikroservis **bilinçli olarak tercih edilmedi**: MVP aşamasında deploy/geliştirme
  hızını korumak öncelikliydi.
- **AI katmanı Ports & Adapters ile izole** (`apps/api/src/ai/ports`, `ai/providers/anthropic`) —
  başka bir LLM'e geçmek yeni bir `ai/providers/<isim>` adaptörü eklemekten ibaret, hiçbir
  çağıran kod değişmez.
- **RAG:** `apps/api/src/rag/` — chunk → Workers AI ile embed → Vectorize'a upsert →
  soru üretiminde top-k benzerlik araması. Üretilen her sorunun hangi kaynak chunk'lardan
  geldiği (`questions.source_chunk_ids`) izlenebilirlik için saklanıyor (halüsinasyon denetimi).
- **`apps/web` → `apps/api` iletişimi bir Cloudflare Service Binding üzerinden** (`/api/*`
  aynı origin'den proxy'leniyor, bkz. `apps/web/src/worker/index.tsx` ve `wrangler.jsonc`'taki
  `services` alanı). Bu **kasıtlı**: Google OAuth session cookie'sinin cross-site sorunlarına
  takılmaması için browser hep tek origin görüyor. Lokal geliştirmede bu binding
  `apps/web/vite.config.ts`'teki `auxiliaryWorkers` sayesinde çalışıyor — `apps/api` ve
  `apps/web` ayrı `wrangler dev`/`vite dev` süreçleri olarak çalıştırılırsa binding çözülmez,
  sadece `pnpm --filter @rubrix/web dev` yeterli (ikisini birden ayağa kaldırır).

## Rol Bazlı Yetkilendirme (RBAC) — kesin kural

4 izole rol: `content_creator` (İçerik Uzmanı), `instructor` (Eğitmen), `student` (Öğrenci),
`admin` (Eğitim Yöneticisi). Roller birbirinin işini yapamaz (içerik uzmanı sınav oluşturamaz,
eğitmen soru üretemez, vb.) — bu bir öneri değil, üzerine kod yazılan sabit bir gereksinim.
Rol ataması **sadece admin** tarafından yapılır (`PATCH /api/users/:id/role`); Google ile giren
yeni kullanıcı `status: pending, role: NULL` olarak oluşur, self-servis rol seçimi yok.

AI çıktısı (üretilen soru, önerilen puan) **hiçbir zaman doğrudan yayına/nota dönüşmez** —
her zaman `pending_review`/`ai_evaluation` gibi bir ara durumda insan onayı bekler
(human-in-the-loop). Bunu bozan bir değişiklik yapılmamalı.

## Klasör Yapısı

```
apps/api/src/
  shared/db/schema/   18 tablolu Drizzle şeması (users, content, questions, exams, grading, audit)
  shared/middleware/  requireAuth (session), requireRole (RBAC guard)
  modules/            auth, users, content, questions, rubrics, exams, grading, reporting
  ai/                 ports (arayüzler) + providers/anthropic (varsayılan adaptör) + prompts
  rag/                chunker, vectorize-client, retriever

apps/web/src/
  worker/index.tsx    SSR + /api/* service-binding proxy
  app/                App.tsx (HTML doküman), router.tsx (rol bazlı route tablosu)
  features/           auth, content-management, exam-management, exam-taking, admin-dashboard
  components/         ui/ (shadcn), layout/RoleGuardedLayout.tsx
```

## Mevcut Durum

**Doğrulandı:** typecheck temiz, D1 migration lokalde uygulandı, iki worker service binding
üzerinden birlikte çalışıyor, SSR + rol koruması uçtan uca test edildi.

**Tamamlanan ek işler:**
- Sınav ekranında çoktan seçmeli soru arayüzü eklendi — `ExamRunnerPage.tsx` artık `multiple_choice`
  sorular için radio-button seçenekleri, `open_ended` için textarea gösteriyor. Backend
  (`exams.repository.ts`/`exams.service.ts`) `startAttempt` yanıtına `isCorrect` sızdırmadan
  seçenekleri (`id`, `label`, `body`) ekliyor.
- Admin panelinde rol atama arayüzü eklendi — `UserManagementPage.tsx` (`/admin/users`),
  `PATCH /api/users/:id/role` ve `POST /api/users/:id/suspend` uçlarına bağlı.
- Wrangler v3 → v4 güncellemesi yapıldı (`wrangler@4.125.0`, `@cloudflare/vite-plugin@1.53.1`,
  `@cloudflare/workers-types@5.x`, `vite@6.4.3`, `@vitejs/plugin-react@4.7.0`). Her iki worker'ın
  `wrangler.jsonc`'u `wrangler types` ile offline doğrulandı, `auxiliaryWorkers` service-binding
  kurulumu değişmeden çalışıyor.
- Gerçek Cloudflare kaynakları oluşturuldu: `rubrix-db` (D1, `database_id` `apps/api/wrangler.jsonc`'a
  yazıldı), `rubrix-embeddings` (Vectorize, 1024 boyut/cosine), `rubrix-doc-processing` (Queue)
  — bkz. commit `b0a630a`. `CF_ACCOUNT_ID` de aynı commit'te placeholder'dan gerçek değere geçti.
  `rubrix-documents` (R2) o commit'te ödeme yöntemi eksikliği nedeniyle ertelenmişti; 2026-08-24'te
  hesaba ödeme yöntemi eklenip `wrangler r2 bucket create rubrix-documents` ile oluşturuldu. Dört
  kaynağın tamamı `wrangler ... list` ve doğrudan Cloudflare API sorgusuyla canlı doğrulandı.

- Google OAuth client'ı gerçek değerlerle bağlandı: `GOOGLE_CLIENT_ID` `apps/api/wrangler.jsonc`'a,
  `GOOGLE_CLIENT_SECRET` (git'e girmeyen) `apps/api/.dev.vars`'a yazıldı. Redirect URI hâlâ
  `http://localhost:8787/api/auth/google/callback` (lokal) — prod'a deploy edilince Google Cloud
  Console'daki OAuth client'a prod URL'nin de authorized redirect URI olarak eklenmesi gerekiyor.
- `rubrix-gateway` adında gerçek bir Cloudflare AI Gateway oluşturuldu (Cloudflare API üzerinden,
  2026-08-24) ve `CF_AI_GATEWAY_ID` `apps/api/wrangler.jsonc`'a yazıldı. Artık `wrangler.jsonc`'ta
  `REPLACE_WITH_*` placeholder kalmadı.

**Bekliyor (henüz yapılmadı):**
- Production'a deploy (henüz public domain yok).
- (Opsiyonel, wrangler tarafından önerildi) `@cloudflare/workers-types`'tan `wrangler types`'ın
  ürettiği runtime type'larına geçiş — şimdilik deprecated ama çalışır durumda, bilinçli olarak
  yapılmadı.

## Geliştirme

```bash
pnpm install
pnpm --filter @rubrix/web dev   # http://localhost:5173 — api'yi de service binding ile ayağa kaldırır
pnpm --filter @rubrix/api dev   # apps/api'yi tek başına denemek için (http://localhost:8787)
pnpm db:generate                # şema değişince Drizzle migration üret
pnpm db:migrate:local           # lokal D1'e uygula
```

`.dev.vars.example` dosyalarını `.dev.vars` olarak kopyalayıp gerçek secret'ları
(`GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`) girmeden Google login ve AI özellikleri çalışmaz.
