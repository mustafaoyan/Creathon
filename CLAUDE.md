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

**Artık 4 rolün de self-servis, anında aktif** (bilinçli olarak admin-onay akışından değiştirildi —
kullanıcı test sürecinde onay beklemenin gereksiz sürtünme yarattığını belirtti). Login ekranı iki
kademeli: nav'da doğrudan **"ÖĞRENCİ GİRİŞİ 🚀"** butonu var (öğrenci platformun asıl kullanıcı
kitlesi olduğu için headline rol) — yanında, RUBRIX NEDİR/ROLLER ile aynı stilde bir **"DİĞER
GİRİŞLER"** metin linki var; buna tıklanınca kalan 3 rolün (Eğitmen, İçerik Uzmanı, **admin dahil**)
kartları ayrı ayrı açılıyor. Hangi kart tıklanırsa `requestedRole` o olarak Google OAuth'a taşınıyor,
`users.repository.ts#createFromGoogle` her 4 rol için de kullanıcıyı direkt
`status: active, role: <talep edilen rol>` ile oluşturuyor — onay yok, `pending` durumu artık hiç
oluşmuyor.

**`admin` self-servisi bir davet koduyla korunuyor** — kullanıcı önce açık riski (herkes tek tıkla
admin olabilir) kabul etti, sonra kendisi "sadece kodu bilenler admin olabilsin" fikrini getirdi.
Uygulama: `ADMIN_INVITE_CODE` secret'ı (`Bindings`, prod'da `wrangler secret put` ile girildi —
değeri sadece gerçek adminlere elden/güvenli kanaldan iletilir, repoda yok). `GET /api/auth/google`,
`role=admin` isteğinde `?code=` query param'ını bu secret'la karşılaştırıyor; eşleşmezse Google'a
hiç gitmeden `403 invalid_admin_code` döndürüyor (`auth.routes.ts`). Frontend'de Eğitim Yöneticisi
kartına bir "Admin Kodu" input'u eklendi (`LoginPage.tsx#RoleLoginCard`), kod boşken her iki giriş
butonu da disabled. `UserManagementPage.tsx` (`PATCH /api/users/:id/role`) hâlâ duruyor — rolleri
sonradan değiştirmek/geri almak/askıya almak için.

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
  worker/index.tsx    SSR + /api/* service-binding proxy + role-home redirect ("/" -> role sayfası)
  app/                App.tsx (HTML doküman), router.tsx (rol bazlı route tablosu)
  features/           auth (LoginPage — carousel + gizli/reveal rol kartları), content-management,
                      exam-management, exam-taking, admin-dashboard
  components/         ui/ (shadcn), layout/RoleGuardedLayout.tsx (auth durumuna göre gate + Sidebar
                      entegrasyonu), layout/TeknofestNav.tsx (sticky üst nav, login + tüm authed
                      ekranlarda ortak), layout/Sidebar.tsx (authed ekranlarda kayan sol menü:
                      avatar, rol bazlı linkler, alt kısımda Çıkış Yap)
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
fazladan yetki. (Not: bu madde sonradan düzeltildi — onay artık sadece `content_creator`.)

**Login/dashboard UX, gerçek tarayıcı testleri sonrası birkaç turda yeniden tasarlandı:**
- Login: uzay temalı tam ekran carousel (7 slayt, senkron fotoğraf+alıntı; crossfade yüzdeleri
  `HERO_SLIDES.length`'e göre JS'te hesaplanıp `<style>` ile enjekte ediliyor — sabit yüzde
  kullanılırsa slayt sayısı değişince pencereler üst üste biner). Rol kartları nav'daki "ÖĞRENCİ
  GİRİŞİ 🚀" / "DİĞER GİRİŞLER" tıklanana kadar gizli (yukarıdaki RBAC bölümüne bkz.); her kartta
  buton sırası sabit: 1) T3 Hesabı ile Giriş Yap, 2) Google Hesabı ile Giriş Yap.
- Üst nav (`TeknofestNav`) **`fixed`** (sticky DEĞİL — sticky, altındaki full-screen hero'nun
  stacking context'ine bağımlı kalıp kayboluyordu), hem login hem tüm authed ekranlarda ortak;
  nav artık normal akışta yer kaplamadığı için onu kullanan her yerde `NAV_HEIGHT_CLASS` (`pt-16`)
  ile eşleşen üst boşluk var. Tüm etkileşimli öğelerde `cursor-pointer` + hover geçişi zorunlu
  (bkz. `Button` bileşeni). `.rbx-starfield` CSS sınıfına ASLA `position` eklenmesin — Tailwind v4
  cascade layer'ları yüzünden katmansız (unlayered) bir `position` kuralı, `fixed`/`sticky` gibi
  Tailwind utility'lerini sessizce eziyor (yaşanmış gerçek bug, bkz. globals.css'teki yorum).
- Authed ekranlarda tam ekran uzay arka planı (`space-globe.jpg`) + sol tarafta hamburger ile
  açılan `Sidebar` (üstte avatar + "Profil Resmini Değiştir", ortada role özel linkler, en altta
  kırmızı hover'lı "Çıkış Yap").
- Giriş sonrası kullanıcı doğrudan rolüne uygun sayfaya yönlendiriliyor (`role-home.ts` +
  worker'daki redirect), genel bir "Merhaba X" ara ekranı yok.

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
