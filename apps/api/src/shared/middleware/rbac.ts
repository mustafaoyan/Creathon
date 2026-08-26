import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../config/env";
import type { UserRole } from "../db/schema";
import { HttpError } from "./error-handler";

/** Requires `requireAuth` to run first so `userRole` is populated.
 *
 * Admin her zaman geçer — "diğer rollerin gözünden bak" özelliği (bkz.
 * RoleGuardedLayout.tsx#viewingAsAdmin, RoleViewsPage.tsx) frontend'de admin'in
 * başka rollerin sayfalarını GÖRMESİNE izin veriyordu ama bu middleware admin'in
 * gerçek rolünü kontrol ettiği için o sayfalardaki gerçek işlemler (sınav
 * oluşturma, soru cevaplama vb.) 403 ile reddediliyordu — admin sadece
 * "bakabiliyor", yapamıyordu (kullanıcı isteği: "tüm yetkilere sahip olsun"). */
export function requireRole(...roles: UserRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("userRole");
    if (!role || (role !== "admin" && !roles.includes(role as UserRole))) {
      throw new HttpError(403, "forbidden");
    }
    await next();
  });
}
