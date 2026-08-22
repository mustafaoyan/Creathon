import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../config/env";
import { createDb } from "../db/client";
import { sessions, users } from "../db/schema";
import { HttpError } from "./error-handler";

export const SESSION_COOKIE_NAME = "rubrix_session";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    throw new HttpError(401, "not_authenticated");
  }

  const db = createDb(c.env.DB);
  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new HttpError(401, "session_expired");
  }

  c.set("userId", row.userId);
  c.set("userRole", row.role);
  await next();
});
