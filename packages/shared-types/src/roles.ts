export const USER_ROLES = ["content_creator", "instructor", "student", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["pending", "active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: UserRole | null;
  status: UserStatus;
};
