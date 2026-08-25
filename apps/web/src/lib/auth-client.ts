import type { UserRole, SessionUser } from "@rubrix/shared-types";
import { apiClient } from "./api-client";

export type { UserRole, SessionUser };

/** All 4 roles are self-service — passing one activates that role immediately
 * on first login. "admin" is intentionally reachable only through the "Diğer
 * Girişler" reveal on the login page, not a headline nav button, since it
 * grants full user/role management — but it IS self-service by user request. */
export function getGoogleLoginUrl(requestedRole?: "content_creator" | "instructor" | "student" | "admin") {
  return requestedRole ? `/api/auth/google?role=${requestedRole}` : "/api/auth/google";
}

export function fetchCurrentUser() {
  return apiClient.get<{ user: SessionUser | null }>("/api/auth/me");
}

export function logout() {
  return apiClient.post("/api/auth/logout");
}
