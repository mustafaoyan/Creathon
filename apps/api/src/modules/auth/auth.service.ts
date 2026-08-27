import { eq } from "drizzle-orm";
import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { sessions, type UserRole } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";
import { recordAuditLog } from "../../shared/lib/audit";
import { usersRepository } from "../users/users.repository";
import { buildGoogleAuthUrl, exchangeCodeForTokens, fetchGoogleUserInfo } from "./google-oauth";

/** Bir e-posta sadece tek bir role ait olabilir — hesap zaten aktif bir role
 * sahipse (ör. öğrenci), başka bir rolün giriş butonundan (ör. "Eğitmen
 * Girişi") aynı Google hesabıyla girmeye çalışmak SESSİZCE eski role
 * (öğrenci) giriş yaptırmamalı; bu kafa karıştırıcıydı (kullanıcı testinde
 * bulundu — "eğitmen girişiyle girdim ama öğrenci olarak giriş yaptım"). */
export class RoleMismatchError extends Error {
  constructor(public actualRole: UserRole) {
    super("role_mismatch");
  }
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Jüri demo girişi — Google OAuth'un tamamen dışında, bilinçli bir istisna.
 * TEK bir e-posta + şifre (kullanıcı isteği: "tek e posta ve şifreyle
 * halledelim") — admin zaten TÜM rollerin ekranlarına ayrı ayrı, tam
 * fonksiyonel yetkiyle girebiliyor (bkz. rbac.ts'teki admin istisnası +
 * Sidebar > "Rol Görünümleri"), bu yüzden jüriye 4 ayrı hesap vermeye hiç
 * gerek yok. Şifre asla düz metin saklanmıyor — SHA-256(şifre + ":" +
 * JURY_LOGIN_PEPPER) hash'i bu dosyada sabit, pepper ise sadece
 * `wrangler secret put` ile prod'da (repoda yok). Bu endpoint SADECE
 * aşağıdaki tek e-postayı kabul ediyor — gerçek kullanıcı hesaplarına bu
 * yoldan asla giriş yapılamaz. */
const JURY_PASSWORD_HASH = "2ab5c0af7b14c46f72d9636ee12dc80214833f1378105e9c82cc1dd528b4f8f1";
const JURY_EMAILS = new Set(["admin@test.rubrix"]);

async function sha256Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class InvalidJuryCredentialsError extends Error {
  constructor() {
    super("invalid_jury_credentials");
  }
}

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
    } else if (requestedRole && user.role && user.role !== requestedRole) {
      throw new RoleMismatchError(user.role);
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

  async juryLogin(env: Bindings, email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!JURY_EMAILS.has(normalizedEmail)) throw new InvalidJuryCredentialsError();

    const submittedHash = await sha256Hex(`${password}:${env.JURY_LOGIN_PEPPER}`);
    if (submittedHash !== JURY_PASSWORD_HASH) throw new InvalidJuryCredentialsError();

    const db = createDb(env.DB);
    const user = await usersRepository.findByEmail(db, normalizedEmail);
    if (!user) throw new InvalidJuryCredentialsError();

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
      metadata: { email: user.email, via: "jury_login" },
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
