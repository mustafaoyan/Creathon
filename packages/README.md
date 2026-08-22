# packages/

Apps arasında paylaşılan kod.

- `shared-types` — RBAC rol/durum enum'ları ve API DTO tipleri (`@rubrix/shared-types`).
  Hem `apps/api` (Drizzle şema enum'ları) hem `apps/web` (auth/session tipleri) buradan
  tek kaynaktan besleniyor; FE/BE arasında tip sürüklenmesini önler.

Yeni paylaşılan modül eklerken (örn. `ui`, `validation`) aynı desen izlenmeli: `package.json`
`main`/`types` alanı doğrudan `src/index.ts`'i gösterir (ayrı bir build adımı gerekmez,
Vite/Wrangler bundler'ları TS kaynağını doğrudan işler).
