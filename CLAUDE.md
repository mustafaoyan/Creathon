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

**Production'da canlı:** https://rubrix-web.tahauguducu.workers.dev (Cloudflare hesabı
`Tahauguducu@gmail.com's Account`, `account_id: 4c93a1fdd11680cf952f1bf1c7f8f9b9` —
`wrangler.jsonc`'larda sabitlendi çünkü ekip birden fazla Cloudflare hesabına erişimli).
Gerçek D1/R2/Vectorize/Queue/AI Gateway kaynakları kurulu, Google OAuth gerçek client'la
çalışıyor, `wrangler d1 migrations apply --remote` ile remote DB güncel tutuluyor.

**2026-08-25: Briefe karşı denetim yapıldı, 8 gerçek eksik bulunup kapatıldı.** Backend/API
mantığı MVP'nin 6 zorunlu maddesini karşılıyordu ama frontend'de ciddi boşluklar vardı —
hepsi kapatıldı:
1. Kazanım tanımlama arayüzü yoktu → `LearningOutcomesPage.tsx` (`/content/outcomes`) eklendi.
2. `learning_outcomes`'ta "konu"/"seviye" alanı yoktu → `topic`/`level` (`OUTCOME_LEVELS`) eklendi.
3. Soru üretimini tetikleyecek arayüz yoktu → `GenerateQuestionsPage.tsx` (`/content/generate`).
4. Soru onay panelinde MCQ şıkları görünmüyordu, düzenleme yoktu → `GET /api/questions` artık
   MCQ soruları için `options` (isCorrect dahil) döndürüyor, panel düzenleme moduna sahip.
5. Sınav oluşturma sadece taslak bırakıyordu, yayınlama/atama arayüzü yoktu → `CreateExamPage.tsx`
   artık oluşturduktan sonra öğrenci seçip yayınlıyor (`GET /api/users/students` eklendi —
   admin-only blok'un dışında, instructor+admin erişebiliyor; `GET /api/exams` de eklendi).
6. Rubrik oluşturma arayüzü yoktu → `GenerateQuestionsPage.tsx` içine inline hızlı oluşturma
   eklendi (açık uçlu soru üretimi zaten rubrik gerektirdiği için aynı sayfaya alındı).
7. Öğrenci sonucunu hiçbir yerde göremiyordu → `ExamRunnerPage.tsx`'teki "Atanan Sınavlarım"
   listesi artık puanı gösteriyor (`assignmentsForStudent` `exam_attempts`'e join edildi).
8. Sadece tek-öğrenci bazlı kazanım raporu vardı, sınıf geneli yoktu → `GET /api/reporting/outcomes`
   + Dashboard'da "Öğrenme Çıktıları (Sınıf Geneli)" bölümü (en zayıf kazanım üstte sıralı).

Sadece madde 6'daki (soru onayını hem içerik uzmanı hem eğitmen yapabiliyor, brief'te sadece
içerik uzmanına atanmış) küçük bir yetki-kapsamı farkı bilinçli olarak düzeltilmedi — hata değil,
fazladan yetki.

**Test verisi:** Production D1'de gerçek admin hesabına (`mstfoyn63@gmail.com`) ek olarak
`user_test_content` / `user_test_instructor` / `user_test_student` adında sabit test kullanıcıları
ve karşılık gelen `sess_test_*` session id'leri var (doğrudan SQL ile eklendi, gerçek Google
hesabı değil) — yukarıdaki 8 maddeyi curl ile uçtan uca doğrulamak için kullanıldı. Silinmedi,
kullanıcı henüz karar vermedi; tarayıcıda gerçek hesaplarla test ederken bunlarla karışmasın diye
burada not düşülüyor.

**Bekliyor (bilinçli olarak yapılmadı):**
- **`ANTHROPIC_API_KEY` — Anthropic hesabında kredi yok** (`credit balance too low` hatası).
  Kod/entegrasyon çalışıyor (gateway'e ulaşıyor, hata doğru parse ediliyor), sadece ödeme bekliyor.
  Bu yüzden soru üretimi ve AI rubrik puanlaması prod'da henüz gerçek bir LLM çağrısıyla
  denenmedi — MCQ akışı (otomatik puanlama dahil) elle eklenen sorularla uçtan uca doğrulandı.
- Özel domain yok, `workers.dev` kullanılıyor.
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
