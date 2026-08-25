import { useState } from "react";

export const SPACE_BG_URL = '/hero/space-globe.jpg';

type NavAction = { label: string; onClick?: () => void; href?: string };
type NavTextLink = { label: string; onClick: () => void };

/** Height in px — must match the top padding every page that renders this nav
 * adds to its content (NAV_HEIGHT_CLASS below), since the nav is `fixed` and
 * no longer reserves space in normal document flow. */
export const NAV_HEIGHT_CLASS = "pt-16";

const ABOUT_ROLES = [
  { label: "İçerik Uzmanı", detail: "Kaynak içerik yükler, kazanım tanımlar, AI soru üretimini tetikler." },
  { label: "Eğitmen", detail: "Sınav oluşturur, AI'nin puanlama önerisini inceleyip son kararı verir." },
  { label: "Öğrenci", detail: "Atanan sınavlara girer, sonuçlarını takip eder." },
  { label: "Eğitim Yöneticisi", detail: "Sistem genelinde tamamlanma oranlarını ve istatistikleri izler." },
];

/** Shared top nav — used on the login page (action = reveal role choice) and
 * on every authenticated screen (action = log out), so the look is consistent
 * everywhere, not just on "/login". `fixed` (not `sticky`) so it is always
 * pinned above the page — immune to any scroll position or stacking-context
 * quirks in the sections rendered below it (e.g. the full-screen hero). */
export function TeknofestNav({
  action,
  secondaryLink,
}: {
  action: NavAction;
  /** Login ekranında "Öğrenci Girişi" butonunun yanında, RUBRIX NEDİR ile aynı
   * stilde bir metin linki — diğer 3 rolün giriş kartlarını açar. */
  secondaryLink?: NavTextLink;
}) {
  const [showAbout, setShowAbout] = useState(false);

  return (
    // Kasıtlı olarak kendi arka planı YOK — teknofest.org.tr'deki gibi çubuk,
    // arkasındaki sayfanın (bg-fixed, aynı görsel) üstünde tamamen şeffaf
    // duruyor. Önceden nav'ın kendi (farklı kırpılmış) arka plan görseli +
    // gradyan katmanı vardı, bu da nav'ı sayfanın geri kalanından farklı bir
    // renk tonunda gösteriyordu (kullanıcı testinde bulundu) — nav'ın altındaki
    // her sayfa zaten aynı SPACE_BG_URL'i bg-fixed ile kullandığı için, nav
    // şeffaf olunca görsel kusursuzca devam ediyor.
    <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center overflow-visible px-6 text-white">
      <div className="relative z-10 flex w-full items-center justify-between gap-4">
        <span className="text-lg font-extrabold tracking-wide">RUBRIX</span>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-6 text-sm font-semibold sm:flex">
            <button
              type="button"
              onClick={() => setShowAbout((prev) => !prev)}
              aria-expanded={showAbout}
              className="cursor-pointer transition-colors hover:text-primary"
            >
              RUBRIX NEDİR
            </button>
            {secondaryLink && (
              <button
                type="button"
                onClick={secondaryLink.onClick}
                className="cursor-pointer transition-colors hover:text-primary"
              >
                {secondaryLink.label}
              </button>
            )}
          </div>
          {action.href ? (
            <a
              href={action.href}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              {action.label}
            </button>
          )}
          <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">2026</span>
        </div>
      </div>

      {showAbout && (
        // rbx-glass BİLEREK yok — o sınıfın katmansız `background` kuralı, Tailwind
        // utility'lerinin (bu satırdaki bg-[#050814]) önüne geçip paneli neredeyse
        // saydam gösteriyordu (aynı .rbx-starfield/`fixed` sorunuyla aynı kök neden).
        <div className="rbx-reveal absolute left-1/2 top-full z-20 mt-3 w-[92vw] max-w-md -translate-x-1/2 rounded-xl border border-white/15 bg-[#050814] p-5 text-left shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-4">
            <h3 className="text-base font-bold text-white">RubriX Nedir?</h3>
            <button
              type="button"
              onClick={() => setShowAbout(false)}
              aria-label="Kapat"
              className="cursor-pointer rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-white/80">
            RubriX, TEKNOFEST T3 Vakfı için geliştirilen yapay zekâ destekli bir ölçme ve değerlendirme
            platformudur. Kaynak içerikten sınav sorusu üretir, açık uçlu yanıtları rubrik bazlı AI ile
            ön değerlendirir — ama nihai kararı her zaman bir insana (eğitmene) bırakır.
          </p>
          <ul className="flex flex-col gap-2">
            {ABOUT_ROLES.map((role) => (
              <li key={role.label} className="text-xs text-white/70">
                <span className="font-semibold text-white">{role.label}:</span> {role.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
