# RubriX

Yapay Zekâ Destekli Ölçme ve Değerlendirme Sistemi — TEKNOFEST T3 Vakfı için geliştiriliyor.
Kaynak metinden RAG ile soru üreten, açık uçlu yanıtları rubrik bazlı AI ile ön-değerlendirip
nihai kararı her zaman bir insana (eğitmene) bırakan bir sınav platformu.

Bu dosya, bu repoda açılan her Claude Code oturumuna otomatik yükleniyor — proje hakkında
konuşma geçmişini bilmeyen biri (başka bir makine, başka biri) buradan hızlıca bağlam kazanır.
**Bu dosya periyodik olarak baştan yazılıp güncel duruma göre sadeleştiriliyor** — geçmişteki her
denemeyi/hata düzeltmeyi kronolojik anlatmak yerine, kalıcı olarak geçerli mimari kararları ve
tekrar yaşanabilecek gerçek tuzakları (gotcha) özetliyor.

## Teknoloji Yığını

- **Monorepo:** pnpm workspace (`apps/*`, `packages/*`), Turborepo yok — sade `pnpm -r` script'leri.
- **Backend (`apps/api`):** Hono, Cloudflare Workers. D1 (SQLite, Drizzle ORM), R2 (dosya depolama),
  Vectorize (embedding arama), Workers AI (`bge-m3` çok dilli embedding + şu an soru
  üretimi/puanlama için de `Llama 3.3 70B`), Cloudflare Queues (asenkron PDF işleme + soru üretimi).
- **Frontend (`apps/web`):** Hono ile serve edilen Vite SSR + React 19 + Shadcn UI + Tailwind v4.
- **Auth:** Google OAuth, sunucu tarafı session (D1 `sessions` tablosu, cookie).
- **AI sağlayıcı:** Ports & Adapters (bkz. aşağı) — şu an aktif adaptör **`workers-ai`**
  (Cloudflare'in kendi modelleri, ücretsiz kota). `anthropic` adaptörü de yazılı ve hazır ama
  Anthropic hesabında kredi olmadığı için kullanılamıyor (detay: "Production Durumu" bölümü).
- **Paylaşılan:** `packages/shared-types` — RBAC rolleri ve DTO'lar hem `@rubrix/api` hem
  `@rubrix/web` tarafından buradan içe aktarılıyor.

## Mimari Kararlar (neden böyle kuruldu)

- **Modüler Monolit, mikroservise hazır** — `apps/api/src/modules/*` her biri kendi
  routes/service/repository katmanına sahip, bağımsız bir Worker'a ayrılabilecek kadar izole.
  Gerçek çoklu-Worker mikroservis **bilinçli olarak tercih edilmedi**: MVP aşamasında deploy/geliştirme
  hızını korumak öncelikliydi.
- **AI katmanı Ports & Adapters ile izole** (`apps/api/src/ai/ports`, `ai/providers/{anthropic,workers-ai}`)
  — başka bir LLM'e geçmek yeni bir `ai/providers/<isim>` adaptörü eklemekten ibaret, hiçbir
  çağıran kod değişmez. Aktif adaptör `wrangler.jsonc`'taki `AI_PROVIDER` env var'ı ile seçiliyor.
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
  **Prod'da kritik bir kısıtlama var:** Cloudflare, aynı hesaptaki iki worker'ın service binding
  ile birbirini çağırmasını `*.workers.dev` hostname'i üzerinden ENGELLİYOR ("error code: 1042")
  — bu yüzden `rubrix-web` artık sadece özel domain'den (`app.hititai.com`) erişilebilir,
  `workers_dev` bilinçli olarak kapalı (bkz. Production Durumu).
- **AI çıktısı hiçbir zaman doğrudan yayına/nota dönüşmez** — her zaman `pending_review`/
  `ai_evaluation` gibi bir ara durumda insan onayı bekler (human-in-the-loop). Bunu bozan bir
  değişiklik yapılmamalı.
- **Asenkron işler kuyrukta, sayfa kapansa da devam eder** — PDF işleme (`DOC_QUEUE`) ve soru
  üretimi (`QUESTION_GEN_QUEUE`) ikisi de `POST` isteğinde senkron await edilmiyor; sadece bir
  iş kaydı oluşturup kuyruğa atıyor, gerçek iş `src/index.ts`'teki tek `queue()` handler'ında
  (`batch.queue` ile ayırt edilir) arka planda çalışıyor. Frontend job durumunu polling ile takip
  ediyor. 3 dakikadan uzun "processing" kalan bir iş, okuma anında otomatik "failed" işaretleniyor
  (lazy reconciliation — ayrı bir cron gerekmiyor).

## Rol Bazlı Yetkilendirme (RBAC) — kesin kural

4 izole rol: `content_creator` (İçerik Uzmanı), `instructor` (Eğitmen), `student` (Öğrenci),
`admin` (Eğitim Yöneticisi). Roller birbirinin işini yapamaz (içerik uzmanı sınav oluşturamaz,
eğitmen soru üretemez, vb.) — bu bir öneri değil, üzerine kod yazılan sabit bir gereksinim.

**Login ekranı iki kademeli:** nav'da doğrudan **"ÖĞRENCİ GİRİŞİ 🚀"** butonu var (öğrenci
platformun asıl kullanıcı kitlesi olduğu için headline rol) — yanında **"DİĞER GİRİŞLER"** metin
linki var; buna tıklanınca kalan 3 rolün (Eğitmen, İçerik Uzmanı, admin dahil) kartları ayrı ayrı
açılıyor. Hangi kart tıklanırsa `requestedRole` o olarak Google OAuth'a taşınıyor. Buton metni
**"Google ile Devam Et"** (fiilen Google OAuth'a yönlendiriyor — T3 Vakfı'nın kendi kimlik
doğrulama sistemi henüz yok, "T3 ile giriş" gibi görünen bir metin kafa karıştırıyordu).

**Rol bazında self-servis seviyesi farklı — 3 katman:**
- **`student`** — tamamen açık self-servis, hiçbir kısıtlama yok.
- **`content_creator` / `instructor`** — **sadece admin'in `role_allowlist` tablosuna eklediği
  e-posta adresleri** için self-servis (herkese açık olması bilinçli olarak kapatıldı — güvenlik
  açığıydı). `users.repository.ts#createFromGoogle`, ilgili rol için normalize edilmiş
  (trim+lowercase) e-postayı `role_allowlist`'te arıyor; bulamazsa hesap `status: pending,
  role: null` ile oluşuyor (admin `Kullanıcı Yönetimi`'nden manuel atayabilir). Admin API:
  `GET/POST /api/users/role-allowlist`, `DELETE /:id` (hepsi admin-only) —
  `UserManagementPage.tsx`'te "Eğitmen / İçerik Uzmanı İzin Listesi" bölümünden yönetiliyor.
  Kontrol sadece yeni kayıtta (ilk girişte) çalışıyor, mevcut aktif hesapları geriye dönük iptal
  etmiyor.
- **`admin`** — bir davet koduyla korunuyor. `ADMIN_INVITE_CODE` secret'ı (prod'da
  `wrangler secret put` ile girildi, repoda yok). `GET /api/auth/google`, `role=admin` isteğinde
  `?code=` query param'ını bu secret'la karşılaştırıyor; eşleşmezse Google'a hiç gitmeden
  `403 invalid_admin_code` döndürüyor. Frontend'de Eğitim Yöneticisi kartına bir "Admin Kodu"
  input'u var, kod boşken giriş butonu disabled.

`UserManagementPage.tsx` (`PATCH /api/users/:id/role`) her durumda duruyor — rolleri sonradan
değiştirmek/geri almak/askıya almak için (allowlist'ten bağımsız, admin'in her zamanki genel yetkisi).

**Bir e-posta = bir rol (kullanıcı testinde bulundu — önceden bir hesap zaten aktif bir role
sahipken başka bir rolün giriş butonundan girmeye çalışınca SESSİZCE eski role giriş yapıyordu,
"eğitmen girişiyle girdim ama öğrenci oldum" gibi kafa karıştırıcı bir deneyimdi).**
`auth.service.ts#handleGoogleCallback`, `googleId` ile eşleşen bir hesap bulunduğunda artık
`requestedRole`'ü `user.role` ile karşılaştırıyor — farklıysa `RoleMismatchError` fırlatıyor,
`auth.routes.ts` bunu yakalayıp `/login?authError=role_mismatch&actualRole=...`'a yönlendiriyor
(ham bir JSON hata sayfası göstermek yerine — bu bir tarayıcı redirect akışı). `LoginPage.tsx`
bu query param'ı okuyup "Bu e-posta zaten X olarak kayıtlı" toast'ı gösteriyor ve ilgili kartı açıyor.

## Klasör Yapısı

```
apps/api/src/
  shared/db/schema/   Drizzle şeması (users, content, questions, exams, grading, audit) — migration 0005'te
  shared/middleware/  requireAuth (session), requireRole (RBAC guard)
  modules/            auth, users, content, questions, rubrics, exams, grading, reporting
  ai/                 ports (arayüzler) + providers/{anthropic,workers-ai} + prompts
  rag/                chunker, vectorize-client, retriever

apps/web/src/
  worker/index.tsx    SSR + /api/* service-binding proxy + post-login redirect ("/" -> /welcome, TÜM roller)
  app/                App.tsx (HTML doküman + favicon), router.tsx (route tablosu — bkz. "Sayfa Haritası")
  features/
    auth/             LoginPage — tam ekran carousel + gizli/reveal rol kartları, mobilde ☰ menü
    home/             WelcomePage (bare route, ortak karşılama), MyProfilePage (/profile, tüm roller)
    content-management/  UploadDocumentPage (yükleme + kazanım tanımlama BİRLİKTE), GenerateQuestionsPage
                          (kaynak seçilince kazanım otomatik), QuestionReviewPanel
    exam-management/  CreateExamPage (parti bazlı soru havuzu), GradingReviewPage
    exam-taking/       ExamRunnerPage
    admin-dashboard/   DashboardPage (özet istatistikler), UserManagementPage, RoleViewsPage,
                        OutcomesReportPage, AuditLogPage — hepsi ayrı route, ☰ menüde ayrı ayrı
  components/
    ui/               shadcn bileşenleri + toast-container.tsx
    layout/           RoleGuardedLayout.tsx (auth gate + h-screen/overflow-hidden arka plan mimarisi +
                       Sidebar entegrasyonu + bare route desteği), TeknofestNav.tsx (fixed, şeffaf,
                       login+authed ortak, mobilde ☰ menü), Sidebar.tsx (kayan sol menü: avatar +
                       "Bilgilerim" + rol bazlı linkler + Çıkış Yap)
  lib/                toast.ts (pub-sub bildirim sistemi), api-client.ts, auth-client.ts
```

## Sayfa Haritası (rol → route)

| Rol | Route | Sayfa |
|---|---|---|
| (herkes, auth'suz) | `/login` | LoginPage |
| (herkes, auth'lu) | `/welcome` | WelcomePage (bare) |
| (herkes, auth'lu) | `/profile` | MyProfilePage |
| content_creator | `/content/upload` | UploadDocumentPage (belge yükle + kazanım tanımla) |
| content_creator | `/content/generate` | GenerateQuestionsPage (AI ile soru üret) |
| content_creator | `/content/review` | QuestionReviewPanel (soru onay) |
| instructor | `/exams/new` | CreateExamPage (başlık/süre + seçili soru sayısı + Sınavı Oluştur) |
| instructor | `/exams/pool` | QuestionPoolPage (parti bazlı soru seçimi — ayrı sayfa) |
| instructor | `/exams/grading` | GradingReviewPage (AI puanlama onayı) |
| instructor | `/exams/reports` | ExamResultsPage (sınav → öğrenci → cevap+AI detayı) |
| student | `/exams/take` | ExamRunnerPage (sınavlarım + çözüm ekranı) |
| student | `/exams/results` | StudentResultsPage (Sonucum) |
| admin | `/dashboard`, `/admin` | DashboardPage (özet istatistikler) |
| admin | `/admin/users` | UserManagementPage |
| admin | `/admin/role-views` | RoleViewsPage ("... gözüyle" — diğer rollerin ekranlarını gez) |
| admin | `/admin/outcomes` | OutcomesReportPage (sınıf geneli kazanım raporu) |
| admin | `/admin/audit-log` | AuditLogPage (giriş/çıkış kayıtları) |

## Production Durumu

- **Canlı adres:** https://app.hititai.com — Cloudflare Custom Domain olarak `apps/web/wrangler.jsonc`'ta
  `routes` ile bağlı. Eski `https://rubrix-web.tahauguducu.workers.dev` ÇALIŞMIYOR (bilinçli —
  bkz. Mimari Kararlar'daki "error code 1042" notu). Google OAuth redirect URI
  (`apps/api/wrangler.jsonc`) ve Google Cloud Console'daki "Authorized redirect URIs" ikisi de
  `app.hititai.com`'a güncel.
- **Cloudflare hesabı:** `Tahauguducu@gmail.com's Account`, `account_id: 4c93a1fdd11680cf952f1bf1c7f8f9b9`
  — `wrangler.jsonc`'larda sabitlendi çünkü ekip birden fazla Cloudflare hesabına erişimli.
- Gerçek D1/R2/Vectorize/Queue/AI Gateway kaynakları kurulu, Google OAuth gerçek client'la
  çalışıyor, `wrangler d1 migrations apply --remote` ile remote DB güncel tutuluyor (şu an
  migration `0005`).
- **AI sağlayıcı `workers-ai` (Llama 3.3 70B) — Anthropic'e geçilmedi.** Anthropic hesabında
  kredi yok ("credit balance too low"), birden fazla kez "kredi eklendi" denendi, hep aynı hata
  devam etti. `AI_PROVIDER`'ı `"anthropic"`a çevirmeden önce mutlaka gerçek bir sınav
  gönderimiyle (açık uçlu soru + `wrangler tail`) doğrulanmalı — sadece "kredi eklendi" sözüne
  güvenilmemeli.
- **Test verisi:** Production D1'de gerçek admin hesabına (`mstfoyn63@gmail.com`) ek olarak
  `user_test_content` / `user_test_instructor` / `user_test_student` adında sabit test kullanıcıları
  ve karşılık gelen `sess_test_*` session id'leri var (doğrudan SQL ile eklendi, gerçek Google
  hesabı değil). Silinmedi, kullanıcı henüz karar vermedi.
- Uçtan uca gerçek veriyle doğrulandı: RAG destekli soru üretimi (kaynak metinden gerçekçi MCQ +
  açık uçlu sorular, doğru şıklar, `sourceChunkIds` izlenebilirliği) ve rubrik bazlı puanlama
  (kriter bazlı gerekçe) ikisi de canlıda çalışıyor.

## Bilinen Tuzaklar (Gotcha'lar) — tekrar yaşanmasın diye

- **Tailwind v4 cascade layer:** `globals.css`'te `@layer` DIŞINDA (katmansız) yazılan bir CSS
  kuralı, aynı özelliği (örn. `position`, `background`) veren Tailwind utility class'larının
  ÖNÜNE geçer — sınıf sırası/specificity önemli değil. İki kez yaşandı: `.rbx-starfield`'a
  `position` eklenince nav'ın `fixed` class'ı görmezden gelindi; `.rbx-glass`'ın `background`'ı
  bir panelin `bg-[#050814]` class'ını eziyordu. **Kural: özel (unlayered) CSS class'ları asla
  Tailwind utility'lerinin de set ettiği bir property'yi set etmesin.**
- **`bg-fixed` arka plan asla element'in kendi yüksekliğinden fazlasını kaplamaz** — sadece
  viewport'a göre POZİSYONLANIR, element'in kendi border-box'ının dışına asla taşmaz. Bir
  element'in gerçek yüksekliği (iç içe flex/min-height zinciri yüzünden) viewport'tan kısa
  kalırsa, o element'in altında/dışında düz siyah bir alan görünür. **Kalıcı çözüm** (bkz.
  `RoleGuardedLayout.tsx`): arka planı taşıyan dış katmanlar `min-h-screen` DEĞİL, kesin
  `h-screen` + `overflow-hidden` olmalı (viewport'un TAMAMI, ne eksik ne fazla); içerik uzunsa
  sadece EN İÇTEKİ sarmalayıcı `overflow-y-auto` ile kendi içinde kaysın.
- **`overscroll-behavior` gibi kaydırma davranışını değiştiren CSS kuralları asla `html`/`body`'ye
  körlemesine eklenmesin** — bir ekrandaki "elastic bounce" sorununu çözerken başka bir ekrandaki
  GERÇEK (bounce olmayan) kaydırmayı kırabilir. Sadece gerçekten sorunlu olan spesifik container'a
  uygulanmalı; yukarıdaki `h-screen`+`overflow-hidden` deseni zaten body-seviyesi bounce'ı yapısal
  olarak imkânsız kılıyor, ayrıca bir kurala genelde gerek kalmıyor.
- **Cloudflare Worker service binding + `*.workers.dev`:** aynı hesaptaki iki worker birbirini
  service binding ile çağırıyorsa (bizim `/api/*` proxy deseni), bu çağrı `*.workers.dev`
  hostname'i üzerinden erişildiğinde Cloudflare tarafından ENGELLENİR ("error code: 1042").
  Custom domain'de bu kısıtlama yok. Prod'da `workers_dev` bu yüzden bilinçli olarak kapalı.
  `routes` alanı eklenince wrangler `workers_dev`'i varsayılan olarak kapatıyor — açık kalması
  isteniyorsa (istenmiyor, bkz. yukarı) `workers_dev: true` açıkça yazılmalı.
- **Kuyruk/job race condition'ları:** bir job'ın durumunu güncelleyen her repository metodu
  (`markGenerationJobProcessing`, `completeGenerationJob`, `failGenerationJob`) mevcut durumu
  `WHERE status = ...` ile kontrol etmeli — aksi halde kullanıcı iptal ettikten hemen sonra
  kuyruk consumer'ı işi bitirirse, "failed" durumu sessizce "completed"a geri dönebilir.
- **Falsy-ama-geçerli değerler (`0`, `""`) `&&`/varsayılan-değer kontrolleriyle karıştırılmasın:**
  `exam.durationMinutes &&` (0 dakika = süresiz sanılıyordu, `!= null` olmalı), controlled
  number input'ta state hep sayı tutulursa (0 dahil) kullanıcı alanı silip yeni rakam yazamaz
  (state `number | ""` olmalı, boşken `placeholder="0"`).
- **Açık uçlu soru rubriksiz onaylanırsa öğrenci cevabı hiç değerlendirilmeden sessizce atlanır**
  — bu yüzden `questions.service.ts#review`, açık uçlu + rubriksiz onayı `422` ile reddediyor;
  sonradan rubrik eklenirse `POST /questions/:id/regrade` geriye dönük puanlıyor.
- **Bir sınava tekrar giriş engeli:** `attempt.submittedAt` varsa `startAttempt`/`submit` `409`
  döndürür — kontrol edilmezse bitmiş bir sınava geri girilebilir.
- **Google hesap adı düzenlenebilir olmalı** — `userinfo.name` bazen mağaza/cihaz adı gibi
  profesyonel olmayan bir değer taşıyabiliyor, "daha doğru" bir Google alanı yok; kullanıcı kendi
  adını `/profile`'dan (`PATCH /api/users/me`) düzeltebiliyor.
- **Server-render edilen sayfalarda ayrı React ağaçları (Sidebar, üst başlık) sunucudan gelen
  `initialUser`'ı kullanıyor** — bir alt sayfada kullanıcı bilgisi (ör. isim) güncellenince tek
  bir state güncellemesi onları senkron tutmaz, `window.location.reload()` gerekir.
- **Bu uygulamada client-side router yok — sayfalar arası her `<a href>` tam sayfa yenilemesi.**
  Çok adımlı bir akış (ör. sınav oluştururken farklı bir sayfaya gidip soru seçip geri dönmek)
  birden fazla route'a yayılıyorsa, React state'inde tutmak yeterli değil — sayfa değişince
  TÜM state kaybolur (ilk denemede sadece soru seçimini `sessionStorage`'a taşımıştık, başlık/
  süre/katılımcı listesi hâlâ plain state'teydi — kullanıcı testinde "soru seçince diğer alanlar
  siliniyor" olarak bulundu). **Kural: aynı çok-adımlı akıştaki TÜM form alanları aynı
  `sessionStorage` taslağında olmalı, sadece "seçim" gibi tek bir parça değil** — bkz.
  `examDraft.ts` (localStorage değil — sekme kapanınca yarım kalmış taslak otomatik temizlensin).
  `sessionStorage` sunucuda yok — okuma `useState` initializer'ında DEĞİL, mount sonrası bir
  `useEffect`'te yapılmalı (aksi halde SSR/hydration uyuşmazlığı ya da sunucuda crash riski var).

**Doğrulamalı e-posta değiştirme (Resend) — RESEND_API_KEY secret'ı eklenene kadar ÇALIŞMIYOR.**
`/profile`'da E-posta yanındaki "Değiştir", yeni adrese `shared/lib/email.ts` üzerinden Resend HTTP
API'siyle 6 haneli bir kod gönderiyor (`email_change_requests` tablosu, migration `0006`; kod 15dk
geçerli, 60sn cooldown ile spam engelleniyor). `EMAIL_FROM` şu an `"RubriX <noreply@hititai.com>"`
(`wrangler.jsonc`) ama `hititai.com` Resend'de doğrulanmadan (DNS kayıtları) gerçek gönderim
çalışmaz — secret henüz eklenmedi, `RESEND_API_KEY` gelince `wrangler secret put` ile eklenip
canlıda uçtan uca test edilmeli.

**Sınav sonuçları + e-posta ile katılımcı sınırlama (kullanıcı testinde bulundu — önceden eğitmen
sonuçları öğrenci bazında ayrı ayrı göremiyordu, sınav herkese açık dışında bir seçenek yoktu):**
- Yeni `ExamResultsPage.tsx` (`/exams/reports`, eğitmen) — üç seviyeli tek sayfa (route değişmeden,
  local state): sınavlarım → o sınava giren her öğrenci (isme göre sıralı) → bir öğrencinin tüm
  cevapları + AI değerlendirmesi (kriter bazlı gerekçeyle, MCQ'da doğru/işaretlenen şık
  vurgulanarak). Backend: `GET /exams/:id/results`, `GET /exams/:id/results/:studentId`
  (`exams.repository.ts#resultsForExam` / `#answersForStudentInExam`).
- Yeni `StudentResultsPage.tsx` (`/exams/results`, öğrenci — "Sonucum") — aynı `/api/exams/my`
  verisi, sonuca odaklı ayrı bir sunum.
- `CreateExamPage.tsx`'te opsiyonel "Katılımcıları Sınırla" alanı — e-posta eklenirse SADECE o
  e-postalar sınavı görüp girebilir (yeni `exam_allowed_emails` tablosu, migration `0007`); boş
  bırakılırsa **mevcut "herkese açık" varsayılanı aynen sürüyor** (daha önceki bilinçli karar
  bozulmadı, sadece opsiyonel bir override eklendi). `listForStudent` ve `startAttempt` ikisi de
  `examsRepository.isStudentAllowed` ile kontrol ediyor.

**Sınav ekranı UX düzeltmesi:** `ExamRunnerPage.tsx`'te her soru artık ince `border-primary/50`
çerçeveli bir kutu — önceden sorular arasında hiçbir görsel ayraç yoktu, uzun sorularda birbirine
karışıyordu. Çoktan seçmeli radyo/etiket arası boşluk da sıkılaştırıldı (`gap-1.5` + radyo'ya
`m-0`, tarayıcının varsayılan radio margin'i fazladan boşluk yaratıyordu).

**AI puanı kriter bazlı puanlarla tutarsız olabiliyordu (gerçek prod verisinde bulundu — kritik):**
`AnswerScorerPort`'un döndürdüğü `suggestedScore` (üst-seviye) ve `criteriaBreakdown` (kriter bazlı
alt-puanlar) modelde İKİ AYRI, birbirinden bağımsız üretilen alan — Workers AI (Llama 3.3 70B) bazen
bunları tutarsız üretiyor. Gerçek bir örnekte iki kriter de 0 puan + "yetersiz" gerekçesiyken
suggestedScore 100 gelmişti, eğitmen fark etmeden onaylamıştı (`final_grades`'e kadar işlemişti).
**Kalıcı çözüm:** `exams.service.ts#scoreOpenEndedAnswer`, artık modelin `suggestedScore`
alanını HİÇ KULLANMIYOR — kendi `weightedAverageScore()` fonksiyonuyla `criteriaBreakdown`'dan
(rubrik kriter ağırlıklarına göre) hesaplayıp onu kaydediyor; bu iki alan artık matematiksel
olarak asla çelişemez. Ayrıca Puanlama Onayı + Sonuçlar ekranlarında puanlar artık "84 / 100"
formatında (`rubrics.maxScore` join'lenip taşınıyor) — önceden çıplak sayı (`84`) neyin
üzerinden olduğunu göstermiyordu, kullanıcı testinde "anlamadım" diye bulundu.

## Bekliyor (bilinçli olarak yapılmadı)

- (Opsiyonel, wrangler tarafından önerildi) `@cloudflare/workers-types`'tan `wrangler types`'ın
  ürettiği runtime type'larına geçiş — şimdilik deprecated ama çalışır durumda.
- Anthropic'e geçiş — kredi sorunu çözülmedi (bkz. Production Durumu).
- Production'daki `sess_test_*` / `user_test_*` test verilerinin temizlenmesi — kullanıcı henüz
  karar vermedi.
- E-posta değiştirme özelliği için Resend kurulumu (API key + hititai.com domain doğrulaması) —
  yukarıya bkz.

## Geliştirme

```bash
pnpm install
pnpm --filter @rubrix/web dev   # http://localhost:5173 — api'yi de service binding ile ayağa kaldırır
pnpm --filter @rubrix/api dev   # apps/api'yi tek başına denemek için (http://localhost:8787)
pnpm db:generate                # şema değişince Drizzle migration üret
pnpm db:migrate:local           # lokal D1'e uygula
pnpm db:migrate:remote          # (apps/api içinde) prod D1'e uygula
```

`.dev.vars.example` dosyalarını `.dev.vars` olarak kopyalayıp gerçek secret'ları
(`GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`) girmeden Google login ve AI özellikleri çalışmaz.

Her deploy öncesi: `pnpm --filter @rubrix/api typecheck` ve `pnpm --filter @rubrix/web typecheck`
temiz olmalı. Deploy sırası: önce `apps/api` (`wrangler deploy --minify`), sonra `apps/web`
(`pnpm build && wrangler deploy`) — web, api'yi service binding ile çağırdığı için api'nin güncel
olması önce gelir.
