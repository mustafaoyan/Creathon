import type { UserRole, SessionUser } from "@rubrix/shared-types";
import { apiClient } from "./api-client";

export type { UserRole, SessionUser };

/** requestedRole is only a hint shown on the admin approval screen — it never
 * assigns the real role. Only "instructor"/"student" are accepted server-side. */
export function getGoogleLoginUrl(requestedRole?: "instructor" | "student") {
  return requestedRole ? `/api/auth/google?role=${requestedRole}` : "/api/auth/google";
}

export function fetchCurrentUser() {
  return apiClient.get<{ user: SessionUser | null }>("/api/auth/me");
}

export function logout() {
  return apiClient.post("/api/auth/logout");
}
