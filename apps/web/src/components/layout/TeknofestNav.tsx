export const SPACE_BG_URL = '/hero/space-globe.jpg';

type NavAction = { label: string; onClick?: () => void; href?: string };

/** Shared top nav — used on the login page (action = reveal role choice) and
 * on every authenticated screen (action = log out), so the look is consistent
 * everywhere, not just on "/login". Sticky so it stays visible while the page
 * scrolls (e.g. down to the reveal role-choice section on login). */
export function TeknofestNav({ action }: { action: NavAction }) {
  return (
    <nav
      className="rbx-starfield sticky top-0 z-50 overflow-hidden bg-cover bg-center px-6 py-4 text-white"
      style={{ backgroundImage: `url("${SPACE_BG_URL}")` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#050b24]/90 via-[#0b1f4d]/75 to-[#123a7a]/65" />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
          <span aria-hidden="true">🚀</span> RUBRIX
        </span>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-6 text-sm font-semibold sm:flex">
            <a href="#nedir" className="cursor-pointer transition-colors hover:text-primary">
              RUBRIX NEDİR
            </a>
            <a href="#roller" className="cursor-pointer transition-colors hover:text-primary">
              ROLLER
            </a>
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
    </nav>
  );
}
