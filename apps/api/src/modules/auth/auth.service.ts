import { eq } from "drizzle-orm";
import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { sessions, type UserRole } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";
import { recordAuditLog } from "../../shared/lib/audit";
import { usersRepository } from "../users/users.repository";
import { buildGoogleAuthUrl, exchangeCodeForTokens, fetchGoogleUserInfo } from "./google-oauth";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const authService = {
  buildLoginUrl(env: Bindings, state: string) {
    return buildGoogleAuthUrl(env, state);
  },

  async handleGoogleCallback(env: Bindings, code: string, requestedRole: UserRole | null) {
    const tokens = await exchangeCodeForTokens(env, code);
    const profile = await fetchGoogleUserInfo(tokens.access_token);

    const db = createDb(env.DB);
    let user = await usersRepository.findByGoogleId(db, profile.sub);
    if (!user) {
      user = await usersRepository.createFromGoogle(db, {
        googleId: profile.sub,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
        requestedRole,
      });
    }
    if (!user) throw new Error("user_creation_failed");

    const sessionId = newId("sess");
    const now = new Date();
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      createdAt: now,
    });

    await recordAuditLog(db, {
      actorId: user.id,
      action: "user.login",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email },
    });

    return { sessionId, user };
  },

  async destroySession(env: Bindings, sessionId: string) {
    const db = createDb(env.DB);
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

    if (session) {
      await recordAuditLog(db, {
        actorId: session.userId,
        action: "user.logout",
        entityType: "user",
        entityId: session.userId,
      });
    }

    await db.delete(sessions).where(eq(sessions.id, sessionId));
  },
};
