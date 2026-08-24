import type { UserRole, SessionUser } from "@rubrix/shared-types";
import { apiClient } from "./api-client";

export type { UserRole, SessionUser };

/** "content_creator"/"instructor"/"student" are self-service — passing one
 * activates that role immediately on first login. There is no self-service
 * entry for "admin": that role is only ever granted to an already-registered
 * user by an existing admin from the Kullanıcı Yönetimi panel. */
export function getGoogleLoginUrl(requestedRole?: "content_creator" | "instructor" | "student") {
  return requestedRole ? `/api/auth/google?role=${requestedRole}` : "/api/auth/google";
}

export function fetchCurrentUser() {
  return apiClient.get<{ user: SessionUser | null }>("/api/auth/me");
}

export function logout() {
  return apiClient.post("/api/auth/logout");
}
