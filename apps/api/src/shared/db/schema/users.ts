import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "@rubrix/shared-types";

export { USER_ROLES, USER_STATUSES };
export type { UserRole, UserStatus };

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: USER_ROLES }),
  // What the user picked on the login screen (Eğitmen/Öğrenci) — a hint for the
  // admin's approval screen, never auto-applied to `role`.
  requestedRole: text("requested_role", { enum: USER_ROLES }),
  status: text("status", { enum: USER_STATUSES }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// content_creator/instructor self-servis ama korumasız değil — sadece burada
// e-postası kayıtlı kişiler ilk girişte o role anında sahip olabiliyor
// (admin, Kullanıcı Yönetimi ekranından yönetiyor). student/admin bu listeye
// dahil değil: student zaten tamamen açık, admin kendi davet kodu koduyla korunuyor.
export const ROLE_ALLOWLIST_ROLES = ["content_creator", "instructor"] as const;
export type RoleAllowlistRole = (typeof ROLE_ALLOWLIST_ROLES)[number];

export const roleAllowlist = sqliteTable(
  "role_allowlist",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role", { enum: ROLE_ALLOWLIST_ROLES }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({ uniqueEmailRole: unique().on(table.email, table.role) }),
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
