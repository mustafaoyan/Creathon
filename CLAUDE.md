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

**Login ekranı iki kademeli:** nav'da doğrudan **"ÖĞRENCİ GİRİŞİ 🚀"** butonu var (öğrenci
platformun asıl kullanıcı kitlesi olduğu için headline rol) — yanında **"DİĞER GİRİŞLER"** metin
linki var; buna tıklanınca kalan 3 rolün (Eğitmen, İçerik Uzmanı, admin dahil) kartları ayrı ayrı
açılıyor. Hangi kart tıklanırsa `requestedRole` o olarak Google OAuth'a taşınıyor.

**Rol bazında self-servis seviyesi farklı — 3 katman:**
- **`student`** — tamamen açık self-servis, hiçbir kısıtlama yok.
- **`content_creator` / `instructor`** — **sadece admin'in `role_allowlist` tablosuna eklediği
  e-posta adresleri** için self-servis (2026-08-25'te eklendi — kullanıcı bu iki rolün herkese açık
  olmasının güvenlik açığı olduğunu fark etti). `users.repository.ts#createFromGoogle`, ilgili rol
  için normalize edilmiş (trim+lowercase) e-postayı `role_allowlist`'te arıyor; bulamazsa hesap
  eskisi gibi `status: pending, role: null` ile oluşuyor (admin `Kullanıcı Yönetimi`'nden manuel
  atayabilir). Admin API: `GET/POST /api/users/role-allowlist`, `DELETE /:id` (hepsi admin-only) —
  `UserManagementPage.tsx`'te "Eğitmen / İçerik Uzmanı İzin Listesi" bölümünden yönetiliyor.
  **Bu tarihten ÖNCE self-servisle oluşmuş instructor/content_creator hesapları etkilenmedi** —
  kontrol sadece yeni kayıtta (ilk girişte) çalışıyor, mevcut aktif hesapları geriye dönük iptal
  etmiyor.
- **`admin`** — bir davet koduyla korunuyor. `ADMIN_INVITE_CODE` secret'ı (`Bindings`, prod'da
  `wrangler secret put` ile girildi — değeri sadece gerçek adminlere elden/güvenli kanaldan
  iletilir, repoda yok). `GET /api/auth/google`, `role=admin` isteğinde `?code=` query param'ını bu
  secret'la karşılaştırıyor; eşleşmezse Google'a hiç gitmeden `403 invalid_admin_code` döndürüyor
  (`auth.routes.ts`). Frontend'de Eğitim Yöneticisi kartına bir "Admin Kodu" input'u eklendi
  (`LoginPage.tsx#RoleLoginCard`), kod boşken giriş butonu disabled.

`UserManagementPage.tsx` (`PATCH /api/users/:id/role`) her durumda duruyor — rolleri sonradan
değiştirmek/geri almak/askıya almak için (allowlist'ten bağımsız, admin'in her zamanki genel yetkisi).

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

**2026-08-25: 3 gerçek eksik kapatıldı (bir denetim listesinden):**
- **Profil resmi yükleme gerçek** — `POST /api/users/me/avatar` (R2'ye `avatars/{userId}`
  key'iyle yazıyor, ayrı bir kolon gerekmiyor çünkü key kullanıcı id'sinden türetiliyor),
  `GET /api/users/:id/avatar` servis ediyor; `avatarUrl` bu endpoint'e işaret ediyor.
  Önceden sadece bir bildirim gösteriyordu.
- **Sınav süresi artık gerçekten uygulanıyor** — `CreateExamPage`'de süre alanı,
  `ExamRunnerPage`'de geri sayım + otomatik gönderim var; kritik olan, sunucu tarafında da
  `exams.service.ts#assertAttemptNotExpired` süresi dolmuş attempt'lere yeni cevabı reddediyor
  (sadece istemci taraflı sayaç güvenli değil). **Not:** `durationMinutes: 0` özel durumunda
  `exam.durationMinutes &&` kontrolü falsy olduğu için süre sınırı sessizce atlanıyordu —
  `!= null` kontrolüne çevrildi, curl ile uçtan uca doğrulandı.
- `UserManagementPage`'e isim/e-posta/rol/duruma göre client-side arama kutusu eklendi.

**Test verisi:** Production D1'de gerçek admin hesabına (`mstfoyn63@gmail.com`) ek olarak
`user_test_content` / `user_test_instructor` / `user_test_student` adında sabit test kullanıcıları
ve karşılık gelen `sess_test_*` session id'leri var (doğrudan SQL ile eklendi, gerçek Google
hesabı değil) — yukarıdaki 8 maddeyi curl ile uçtan uca doğrulamak için kullanıldı. Silinmedi,
kullanıcı henüz karar vermedi; tarayıcıda gerçek hesaplarla test ederken bunlarla karışmasın diye
burada not düşülüyor.

**2026-08-25: AI özellikleri artık prod'da gerçekten çalışıyor — Anthropic kredisi olmadan.**
Anthropic API, `claude.ai`'nin aksine, model seviyesinden bağımsız olarak her zaman önceden
yüklenmiş kredi istiyor (`credit balance too low`) — bu kredi hâlâ yok. Ama Ports & Adapters
mimarisi tam bunun için kurulmuştu: `ai/providers/workers-ai/*` adaptörü (Llama 3.3 70B,
`response_format: json_schema` ile yapılandırılmış çıktı) eklendi, `AI_PROVIDER` şu an
`"workers-ai"` (Cloudflare'in kendi modelleri, günde 10.000 Neuron ücretsiz kota — kredi kartı
gerekmiyor). Kredi eklenince `wrangler.jsonc`'ta `AI_PROVIDER`'ı `"anthropic"`a çevirmek yeterli
— **ama "kredi eklendi" denemesi 2026-08-25'te bir kez daha test edildi, aynı
`credit balance too low` hatası devam ediyor** (muhtemelen kredi yanlış hesaba/API key'e
eklendi ya da henüz işlenmedi) — tekrar `"workers-ai"`a alındı. Anthropic'e geçmeden önce
gerçek bir sınav gönderimiyle (açık uçlu soru + `wrangler tail`) doğrulanmadan geçiş yapılmamalı.

Uçtan uca gerçek veriyle doğrulandı: RAG destekli soru üretimi (kaynak metinden gerçekçi MCQ +
açık uçlu sorular, doğru şıklar, `sourceChunkIds` izlenebilirliği) ve rubrik bazlı puanlama
(akıcı/tutarlı Türkçe gerekçe + kriter bazlı döküm) ikisi de canlıda test edildi ve çalışıyor.
Test sırasında bulunup düzeltilen bug: Workers AI'nin varsayılan `max_tokens`'ı JSON çıktısını
yarıda kesiyordu — `workers-ai-client.ts`'te `max_tokens: 4096` eklendi.

**Soru üretimi kuyruğa taşındı (kullanıcı testinde bulunan 2 gerçek UX bug'ı için).**
`POST /api/questions/generate` artık RAG+AI çağrısını senkron await ETMİYOR — sadece
`ai_generation_jobs` kaydı oluşturup yeni `rubrix-question-generation` kuyruğuna
(`QUESTION_GEN_QUEUE`) atıyor ve hemen dönüyor. Gerçek iş `questions.service.ts#processGenerationJob`
içinde, `src/index.ts`'teki tek `queue()` handler'ında (`batch.queue` ile DOC_QUEUE'dan ayırt
ediliyor) çalışıyor — tarayıcı sekmesi kapansa/sayfa değişse de iş arka planda tamamlanıyor.
Frontend (`GenerateQuestionsPage.tsx`) job'ı `GET /generate/:jobId` ile 2sn'de bir polling'le takip
ediyor (spinner + geçen süre sayacı), mount olduğunda da `GET /generate-status/latest` ile
kullanıcının en son işini otomatik bulup gösteriyor. `ai_generation_jobs`'a bunun için `rubricId`/
`multipleChoiceCount`/`openEndedCount` eklendi (migration `0003`) — consumer, orijinal isteğin
body'sine artık erişemediği için parametreleri job kaydından okuyor.

**Kuyruğa taşımanın kendi bug'ları da vardı, onlar da düzeltildi:**
- **Sıkışan iş / zaman aşımı:** çok büyük tek bir istek (ör. 30 soru) consumer'ın zaman/CPU
  limitini aşıp try/catch'e hiç girmeden ölebiliyor — ne completed ne failed, sonsuza kadar
  "processing". Artık (a) tek işte en fazla `MAX_QUESTIONS_PER_JOB=10` soru (giriş validasyonu),
  (b) 3 dakikadan uzun süredir queued/processing kalan bir iş, durum sorgulandığında otomatik
  "failed" işaretleniyor (lazy reconciliation, `questions.service.ts`'te `reconcileIfStale`).
- **İptal butonu + race condition:** `POST /generate/:jobId/cancel` eklendi. Bunu güvenli yapmak
  için gerçek bir race bulunup düzeltildi — `markGenerationJobProcessing` hiçbir durum kontrolü
  yapmadan "processing"e çekiyordu; kullanıcı iptal ettikten (status: failed) hemen sonra consumer
  bu satıra gelirse "failed"ı sessizce geri açıyordu. Artık `WHERE status='queued'` ile korunuyor,
  ve AI çağrısı bittiğinde iş "processing" değilse (iptal/zaman aşımı) üretilen sorular havuza
  hiç eklenmiyor.
- **Süre sayacı sıfırlanması:** frontend elapsed-time hesabı sayfa açılış anını değil
  `job.createdAt`'i (sunucu zamanı) baz alıyor — sayfadan çıkıp geri girmek artık sayacı sıfırlamıyor.

**Sınava tekrar giriş engeli + rubriksiz açık uçlu sorunun sessiz hatası (kullanıcı testinde
bulundu, ikisi de gerçek prod verisiyle doğrulandı):**
- `examsService.startAttempt`/`submit`, `attempt.submittedAt` varsa `409 exam_already_submitted`
  döndürüyor — önceden bir attempt bulunursa sorgusuzca tekrar döndürülüyordu, bu yüzden bitmiş
  bir sınava geri girilebiliyordu. `ExamRunnerPage.tsx`'te "Sınavı Bitir" artık direkt göndermiyor,
  "Devam Et" / "Yine de Bitir" iki butonlu bir uyarı gösteriyor; submit sonrası liste yenileniyor.
- **Kök neden bulundu — açık uçlu bir soru rubriksiz onaylanmışsa, `submit()` o cevabı
  `ai_evaluations`'a hiç düşürmeden sessizce atlıyordu** — Puanlama Onayı paneli "değerlendirilecek
  sınav yok" derken aslında sessizce atlanan bir cevap vardı. Artık `questions.service.ts#review`
  açık uçlu + rubriksiz onayı `422` ile reddediyor; `QuestionReviewPanel.tsx`'te rubrik seçilmeden
  "Onayla" disabled. `PATCH /questions/:id` artık `rubricId` de kabul ediyor, yeni
  `POST /questions/:id/regrade` bir soruya sonradan rubrik eklendiğinde o soruya verilmiş ama hiç
  değerlendirilmemiş cevapları geriye dönük puanlıyor (prod'daki 2 gerçek sıkışmış cevap bu yolla
  düzeltildi).

**Sınav yayınlarken elle öğrenci seçme kaldırıldı (kullanıcının bilinçli kararı — "şimdilik").**
Yayınlanmış her sınav, öğrenci olarak giren HERKESE görünüyor — hem yayınlandığı anda kayıtlı
olan hem de ileride kayıt olacak öğrencilere de, dinamik/lazy bir çözümle: `listForStudent`
gerçek `exam_assignments` kayıtlarını + henüz hiç görülmemiş yayınlanmış sınavları (sanal
"assigned" satırı, `id: virtual_<examId>`) birleştirip dönüyor; `startAttempt`, öğrencinin gerçek
kaydı yoksa ama sınav `published`sa ilk girişte kendisine otomatik atıyor (`assignStudents` artık
`onConflictDoNothing` kullanıyor). `CreateExamPage.tsx`'teki öğrenci seçim adımı kaldırıldı, sadece
"Yayınla" var. Backend'deki manuel `POST /exams/:id/assign` endpoint'i dokunulmadan duruyor
(ileride elle override gerekirse), sadece frontend artık çağırmıyor.

**Bekliyor (bilinçli olarak yapılmadı):**
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
