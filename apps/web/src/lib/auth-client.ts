import type { UserRole, SessionUser } from "@rubrix/shared-types";
import { apiClient } from "./api-client";

export type { UserRole, SessionUser };

/** "instructor"/"student" are self-service — passing one activates that role
 * immediately on first login. Omit requestedRole for content_creator/admin
 * candidates: the account is created as pending and an existing admin must
 * assign the real role from the Kullanıcı Yönetimi panel. */
export function getGoogleLoginUrl(requestedRole?: "instructor" | "student") {
  return requestedRole ? `/api/auth/google?role=${requestedRole}` : "/api/auth/google";
}

export function fetchCurrentUser() {
  return apiClient.get<{ user: SessionUser | null }>("/api/auth/me");
}

export function logout() {
  return apiClient.post("/api/auth/logout");
}
