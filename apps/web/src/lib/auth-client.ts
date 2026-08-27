import type { UserRole, SessionUser } from "@rubrix/shared-types";
import { apiClient } from "./api-client";

export type { UserRole, SessionUser };

/** All 4 roles are self-service — passing one activates that role immediately
 * on first login. "admin" is intentionally reachable only through the "Diğer
 * Girişler" reveal on the login page, not a headline nav button, AND requires
 * `adminCode` to match the server's ADMIN_INVITE_CODE secret — self-service
 * grants full user/role management, so it stays gated behind a shared secret
 * instead of being wide open. */
export function getGoogleLoginUrl(
  requestedRole?: "content_creator" | "instructor" | "student" | "admin",
  adminCode?: string,
) {
  if (!requestedRole) return "/api/auth/google";
  const params = new URLSearchParams({ role: requestedRole });
  if (requestedRole === "admin") params.set("code", adminCode ?? "");
  return `/api/auth/google?${params.toString()}`;
}

/** Jüri demo girişi — Google OAuth'un dışında, bilinçli tek bir istisna
 * (bkz. apps/api auth.service.ts#juryLogin). Tek e-posta + tek şifre; jüri
 * her girişte hangi rolle gireceğini seçiyor, o rolün gerçek demo hesabıyla
 * oturum açılıyor (admin'in "başka rolü izlemesi" değil). Gerçek kullanıcı
 * hesaplarına bu yoldan giriş yapılamaz. */
export function juryLogin(email: string, password: string, role: UserRole) {
  return apiClient.post("/api/auth/jury-login", { email, password, role });
}

export function fetchCurrentUser() {
  return apiClient.get<{ user: SessionUser | null }>("/api/auth/me");
}

export function logout() {
  return apiClient.post("/api/auth/logout");
}
