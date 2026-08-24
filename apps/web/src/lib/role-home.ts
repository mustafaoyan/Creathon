import type { UserRole } from "./auth-client";

/** Where "/" sends an active user with this role — used both for the worker's
 * post-login redirect and (if ever needed) client-side links. */
export const ROLE_HOME: Record<UserRole, string> = {
  content_creator: "/content/upload",
  instructor: "/exams/new",
  student: "/exams/take",
  admin: "/dashboard",
};
