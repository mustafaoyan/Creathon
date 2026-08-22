import type { UserRole, SessionUser } from "@rubrix/shared-types";
import { apiClient } from "./api-client";

export type { UserRole, SessionUser };

export function getGoogleLoginUrl() {
  return "/api/auth/google";
}

export function fetchCurrentUser() {
  return apiClient.get<{ user: SessionUser | null }>("/api/auth/me");
}

export function logout() {
  return apiClient.post("/api/auth/logout");
}
