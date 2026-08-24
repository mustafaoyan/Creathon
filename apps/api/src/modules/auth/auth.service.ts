import { eq } from "drizzle-orm";
import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { sessions, type UserRole } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";
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

    return { sessionId, user };
  },

  async destroySession(env: Bindings, sessionId: string) {
    await createDb(env.DB).delete(sessions).where(eq(sessions.id, sessionId));
  },
};
