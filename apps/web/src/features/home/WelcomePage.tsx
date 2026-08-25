/** Giriş sonrası HERKESİN ilk gördüğü ortak ekran — hangi rolle girilirse
 * girilsin aynı, sade karşılama. `bare` route (bkz. router.tsx) olduğu için
 * arkasında koyu kart YOK, doğrudan uzay arka planı üstünde — bu yüzden metin
 * rengi theme token (text-foreground, ışık modunda koyulaşır) değil, hep
 * beyaz: arka plan burada her zaman koyu. Gerçek işlevler artık burada değil,
 * sol üstteki ☰ menüde (Sidebar) — isteyen oradan açıp ilgili sayfaya gidiyor. */
export function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-4xl font-extrabold tracking-widest text-white [text-shadow:0_0_28px_color-mix(in_srgb,var(--color-primary)_55%,transparent)] sm:text-5xl">
        HOŞ GELDİNİZ
      </h1>
      <p className="max-w-sm text-sm text-white/70">
        Sol üstteki ☰ menüden ihtiyacın olan ekrana ulaşabilirsin
      </p>
    </div>
  );
}
