import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getGoogleLoginUrl } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type Role = "instructor" | "student";

const ROLE_COPY: Record<Role, { title: string; description: string }> = {
  instructor: {
    title: "Eğitmen Girişi",
    description: "Sınav oluştur, soru havuzunu onayla, AI puanlamalarını değerlendir.",
  },
  student: {
    title: "Öğrenci Girişi",
    description: "Sana atanan sınavlara gir, sonuçlarını takip et.",
  },
};

export function LoginPage() {
  const [showRoles, setShowRoles] = useState(false);
  const rolesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showRoles) rolesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showRoles]);

  return (
    <div className="flex flex-col">
      <TeknofestNav onLoginClick={() => setShowRoles(true)} />
      <HeroCarousel />

      {showRoles && (
        <div
          ref={rolesRef}
          id="giris"
          className="rbx-reveal flex flex-col items-center justify-center gap-10 px-4 py-16"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="inline-block h-1.5 w-16 rounded-full bg-primary" />
            <h1 className="text-3xl font-bold">RubriX</h1>
            <p className="text-muted-foreground">Hangi rolle giriş yapmak istiyorsun?</p>
          </div>

          <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
            <RoleLoginCard role="instructor" />
            <RoleLoginCard role="student" />
          </div>
        </div>
      )}
    </div>
  );
}

function TeknofestNav({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <nav
      className="rbx-starfield relative overflow-hidden bg-cover bg-center px-6 py-4 text-white"
      style={{ backgroundImage: 'url("/hero/space-globe.jpg")' }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#050b24]/90 via-[#0b1f4d]/75 to-[#123a7a]/65" />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
          <span aria-hidden="true">🚀</span> RUBRIX
        </span>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-6 text-sm font-semibold sm:flex">
            <a href="#nedir" className="hover:text-primary">
              RUBRIX NEDİR
            </a>
            <a href="#roller" className="hover:text-primary">
              ROLLER
            </a>
          </div>
          <button
            type="button"
            onClick={onLoginClick}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
          >
            GİRİŞ YAP 🚀
          </button>
          <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">2026</span>
        </div>
      </div>
    </nav>
  );
}

// Fotoğraf + söz birebir eşleşiyor ve birlikte değişiyor — biri değişirken diğeri de değişmeli,
// bu yüzden ayrı dizi yerine tek dizi (senkron bozulmasın diye).
const HERO_SLIDES = [
  { image: 'url("/hero/student-desk.jpg")', quote: "Bilgiyi ölçmek değil, öğrenmeyi anlamak." },
  { image: 'url("/hero/ai-workspace.jpg")', quote: "Yapay zekâ önerir, kararı eğitmen verir." },
];

const SLIDE_SECONDS = 6;

function HeroCarousel() {
  const cycleStyle = { "--rbx-cycle": `${HERO_SLIDES.length * SLIDE_SECONDS}s` } as CSSProperties;

  return (
    <section
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden text-white"
      style={cycleStyle}
    >
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

function RoleLoginCard({ role }: { role: Role }) {
  const [showT3Notice, setShowT3Notice] = useState(false);
  const copy = ROLE_COPY[role];

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-border bg-secondary/40 p-6">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <a href={getGoogleLoginUrl(role)} className="w-full">
          <Button className="w-full">Google ile Giriş Yap</Button>
        </a>
        <Button variant="outline" className="w-full" onClick={() => setShowT3Notice(true)}>
          T3 Hesabıyla Giriş Yap
        </Button>
      </div>

      {showT3Notice && (
        <p className="text-xs text-muted-foreground">
          T3 hesabıyla giriş yakında aktif olacak. Şimdilik Google ile devam edebilirsin.
        </p>
      )}
    </div>
  );
}
