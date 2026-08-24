import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
