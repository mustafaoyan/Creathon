import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { getGoogleLoginUrl, testAccountLogin } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { TeknofestNav, SPACE_BG_URL } from "@/components/layout/TeknofestNav";
import { toast } from "@/lib/toast";

type Role = "content_creator" | "instructor" | "student" | "admin";

const ROLE_LABELS: Record<Role, string> = {
  instructor: "Eğitmen",
  content_creator: "İçerik Uzmanı",
  student: "Öğrenci",
  admin: "Eğitim Yöneticisi",
};

const ROLE_COPY: Record<Role, { title: string; description: string }> = {
  instructor: {
    title: "Eğitmen Girişi",
    description: "Sınav oluştur, soru havuzunu onayla, AI puanlamalarını değerlendir.",
  },
  content_creator: {
    title: "İçerik Uzmanı Girişi",
    description: "Kaynak içerik yükle, kazanım tanımla, soru ve rubrik havuzunu oluştur.",
  },
  student: {
    title: "Öğrenci Girişi",
    description: "Sana atanan sınavlara gir, sonuçlarını takip et.",
  },
  admin: {
    title: "Eğitim Yöneticisi Girişi",
    description: "Kullanıcıları ve rolleri yönet, sistem genelinde raporları incele.",
  },
};

/** Öğrenci platformun asıl kullanıcı kitlesi olduğu için nav'da kendi doğrudan
 * butonu var; diğer 3 rol (Eğitmen, İçerik Uzmanı, Admin) "Diğer Girişler"
 * arkasında, ayrı ayrı kartlarla açılıyor — bir öğrenci giriş yaparken
 * eğitmenin/adminin giriş seçeneklerini görmesin diye. */
type RevealMode = null | "student" | "others";

export function LoginPage() {
  const [reveal, setReveal] = useState<RevealMode>(null);
  const rolesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reveal) rolesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [reveal]);

  // Bir hesap zaten bir role sahipse, başka bir rolün giriş butonuyla girmeye
  // çalışmak artık backend'de reddediliyor (auth.routes.ts) — buraya
  // ?authError=role_mismatch&actualRole=... ile geri yönlendiriliyoruz,
  // kullanıcının anlayacağı bir mesaj gösterip ilgili kartı açıyoruz.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (authError !== "role_mismatch") return;

    const actualRole = params.get("actualRole") as Role | null;
    const actualRoleLabel = actualRole ? ROLE_LABELS[actualRole] : "farklı bir rol";
    toast.error(`Bu e-posta zaten ${actualRoleLabel} olarak kayıtlı — o rolün giriş butonunu kullan.`);
    setReveal(actualRole === "student" ? "student" : "others");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    // Nav artık kendi arka planını taşımıyor (bkz. TeknofestNav.tsx) ve BURADA
    // pt-16 (NAV_HEIGHT_CLASS) KASITLI OLARAK KULLANILMIYOR — onu kullansaydık
    // HeroCarousel nav'ın 64px altından başlardı, nav'ın şeffaf alanının
    // arkasında farklı bir görsel (kök div'in statik arka planı) kalır, hemen
    // altında ise Hero'nun kendi (değişen) slayt fotoğrafı başlardı — tam nav'ın
    // alt kenarında görünür bir dikiş/renk sıçraması oluşurdu (kullanıcının asıl
    // şikayeti buydu). Bunun yerine Hero'nun kendisi ekranın tamamını (y:0'dan
    // itibaren, nav'ın ARKASINDAN) kaplıyor — nav şeffaf olduğu için üstündeki
    // aynı slaytı gösteriyor, dikiş kalmıyor.
    <div
      className="flex flex-col bg-fixed bg-cover bg-center"
      style={{ backgroundImage: `url("${SPACE_BG_URL}")` }}
    >
      <TeknofestNav
        action={{ label: "ÖĞRENCİ GİRİŞİ 🚀", onClick: () => setReveal("student") }}
        secondaryLink={{ label: "DİĞER GİRİŞLER", onClick: () => setReveal("others") }}
      />
      <HeroCarousel />

      {reveal && (
        // scroll-mt-20: scrollIntoView({block:"start"}) bu elementin ÜSTÜNÜ viewport'un
        // tam tepesine hizalıyor — ama nav `fixed` olduğu için o bölgeyi kaplıyor, hizalama
        // düzeltilmezse başlık nav'ın arkasında kalıyordu. text-white de kasıtlı: bu başlık
        // kart olmadan doğrudan koyu uzay arka planı üstünde, tema varsayılan rengi (açık
        // temada koyu) kullanılırsa okunmaz hale geliyordu.
        <div
          ref={rolesRef}
          id="giris"
          className="rbx-reveal flex scroll-mt-20 flex-col items-center justify-center gap-10 px-4 py-16"
        >
          <div className="flex flex-col items-center gap-2 text-white">
            <span className="inline-block h-1.5 w-16 rounded-full bg-primary" />
            <h1 className="text-3xl font-bold">RubriX</h1>
            <p className="text-white/70">
              {reveal === "student" ? "Öğrenci olarak giriş yap" : "Hangi rolle giriş yapmak istiyorsun?"}
            </p>
          </div>

          {reveal === "student" ? (
            <div className="flex w-full max-w-xl flex-col gap-6">
              <RoleLoginCard role="student" primary />
            </div>
          ) : (
            <div className="flex w-full max-w-xl flex-col gap-6">
              <RoleLoginCard role="instructor" primary />
              <RoleLoginCard role="content_creator" />
              <RoleLoginCard role="admin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Fotoğraf + söz birebir eşleşiyor ve birlikte değişiyor — biri değişirken diğeri de değişmeli,
// bu yüzden ayrı dizi yerine tek dizi (senkron bozulmasın diye).
const HERO_SLIDES = [
  { image: 'url("/hero/student-desk.jpg")', quote: "Bilgiyi ölçmek değil, öğrenmeyi anlamak." },
  { image: 'url("/hero/ai-workspace.jpg")', quote: "Yapay zekâ önerir, kararı eğitmen verir." },
  { image: 'url("/hero/ai-analytics.jpg")', quote: "Her veri, bir öğrenme hikâyesi anlatır." },
  { image: 'url("/hero/ai-insight.jpg")', quote: "Kaynaktan bilgiye, bilgiden soruya." },
  { image: 'url("/hero/ai-grading.jpg")', quote: "Doğru soru, doğru zamanda, doğru yerde." },
  { image: 'url("/hero/ai-network.jpg")', quote: "Bilgi sınır tanımaz, değerlendirme titizlik ister." },
  { image: 'url("/hero/ai-ecosystem.jpg")', quote: "Teknoloji araçtır, karar hep insanın." },
];

const SLIDE_SECONDS = 4;

/** Her slaytın payı 100/N% — sabit yüzde kullanırsak (ör. 2 slayt için ayarlı
 * bir değer) slayt sayısı değişince pencereler üst üste biner, görsel/yazı
 * karışır. Bu yüzden keyframe'ler HERO_SLIDES.length'e göre burada hesaplanıp
 * <style> ile enjekte ediliyor — slayt eklenip çıkarıldıkça kendini ayarlar. */
function buildCarouselKeyframes(slideCount: number) {
  const slot = 100 / slideCount;
  const fade = slot * 0.18;
  const fadeInEnd = fade.toFixed(2);
  const holdEnd = (slot - fade).toFixed(2);
  const slotEnd = slot.toFixed(2);

  return `
    @keyframes rbx-slide-fade {
      0% { opacity: 0; }
      ${fadeInEnd}% { opacity: 1; }
      ${holdEnd}% { opacity: 1; }
      ${slotEnd}%, 100% { opacity: 0; }
    }
    @keyframes rbx-quote-fade {
      0% { opacity: 0; transform: translateY(14px); }
      ${fadeInEnd}% { opacity: 1; transform: translateY(0); }
      ${holdEnd}% { opacity: 1; transform: translateY(0); }
      ${slotEnd}%, 100% { opacity: 0; transform: translateY(-14px); }
    }
  `;
}

function HeroCarousel() {
  const cycleStyle = { "--rbx-cycle": `${HERO_SLIDES.length * SLIDE_SECONDS}s` } as CSSProperties;

  return (
    <section
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden text-white"
      style={cycleStyle}
    >
      <style dangerouslySetInnerHTML={{ __html: buildCarouselKeyframes(HERO_SLIDES.length) }} />
      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide.image}
          className="rbx-hero-slide"
          style={{ backgroundImage: slide.image, animationDelay: `${index * SLIDE_SECONDS}s` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/40" />

      {HERO_SLIDES.map((slide, index) => (
        <div
          key={slide.quote}
          className="rbx-hero-quote absolute inset-0 flex items-center justify-center px-6"
          style={{ animationDelay: `${index * SLIDE_SECONDS}s` }}
        >
          <p className="max-w-2xl text-center text-2xl font-semibold sm:text-4xl">“{slide.quote}”</p>
        </div>
      ))}
    </section>
  );
}

function RoleLoginCard({ role, primary }: { role: Role; primary?: boolean }) {
  const [adminCode, setAdminCode] = useState("");
  const copy = ROLE_COPY[role];
  const isAdmin = role === "admin";
  const isGatedRole = role === "instructor" || role === "content_creator";
  const adminCodeMissing = isAdmin && adminCode.trim().length === 0;

  return (
    <div
      className={`flex flex-col items-center gap-4 rounded-lg p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 ${
        primary
          ? "border-2 border-primary bg-secondary/60 shadow-lg shadow-primary/10 hover:shadow-[0_0_30px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
          : "border-2 border-border bg-secondary/30 hover:border-primary/40 hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        <h2 className={primary ? "text-xl font-bold" : "text-lg font-semibold"}>{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      {isAdmin && (
        <input
          type="password"
          autoComplete="off"
          placeholder="Admin Kodu"
          value={adminCode}
          onChange={(event) => setAdminCode(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      )}

      {/* T3 Vakfı'nın kendi kimlik doğrulama sistemine henüz erişimimiz yok, fiilen
          Google OAuth'a yönlendiriyor — bu yüzden buton metni de gerçekte ne
          olduğunu net söylüyor ("Google ile Devam Et"), "T3 Hesabı ile Giriş Yap"
          kafa karıştırıyordu (kullanıcı testinde bulundu). T3 erişimi açıldığında
          burası gerçek T3 akışına bağlanacak, o zaman metin de güncellenecek. */}
      <a
        href={getGoogleLoginUrl(role, adminCode)}
        className={`w-full ${adminCodeMissing ? "pointer-events-none" : ""}`}
        aria-disabled={adminCodeMissing}
      >
        <Button className="w-full" disabled={adminCodeMissing}>
          Google ile Devam Et
        </Button>
      </a>

      {isAdmin && (
        <p className="text-xs text-muted-foreground">
          Bu rol, davet koduna sahip olmayan hesaplarca alınamaz.
        </p>
      )}

      {isGatedRole && (
        <p className="text-xs text-muted-foreground">
          Bu rol yalnızca Eğitim Yöneticisi'nin izin verdiği e-posta adresleriyle anında aktif
          olur — izinli değilsen hesabın onay bekleyecek.
        </p>
      )}

      <TestAccountLogin role={role} />
    </div>
  );
}

/** Google'ın kendi hosted OAuth sayfası (accounts.google.com) bizim kontrolümüzde
 * değil — oraya yazılan bir e-postayı biz yakalayamayız, bu yüzden test hesabı
 * girişi ayrı bir küçük alan olarak bu kartın İÇİNDE kalıyor (yeni bir panel/
 * sayfa/buton değil). Varsayılan olarak kapalı — sadece "Test hesabıyla gir"
 * metnine tıklanınca 2 küçük alan açılıyor. Doğru bilgiler bu kartın rolüne
 * (`role`) göre GERÇEK bir oturum açıyor — bkz. apps/api
 * auth.service.ts#testAccountLogin. */
function TestAccountLogin({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await testAccountLogin(email.trim(), password, role);
      window.location.href = "/";
    } catch {
      toast.error("E-posta veya şifre hatalı.");
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
      >
        Test hesabıyla gir
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <input
        type="email"
        autoComplete="off"
        placeholder="E-posta"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
      />
      <input
        type="password"
        autoComplete="off"
        placeholder="Şifre"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
      />
      <Button type="submit" variant="outline" className="w-full text-xs" disabled={submitting}>
        {submitting ? "Giriş yapılıyor..." : "Test Hesabıyla Giriş Yap"}
      </Button>
    </form>
  );
}
