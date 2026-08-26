import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { usersRepository, roleAllowlistRepository, emailChangeRequestsRepository } from "./users.repository";
import type { UserRole, RoleAllowlistRole } from "../../shared/db/schema";
import { HttpError } from "../../shared/middleware/error-handler";
import { sendEmail } from "../../shared/lib/email";

const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateEmailCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String((bytes[0] as number) % 1_000_000).padStart(6, "0");
}

export const usersService = {
  list(env: Bindings) {
    return usersRepository.list(createDb(env.DB));
  },

  listStudents(env: Bindings) {
    return usersRepository.listByRole(createDb(env.DB), "student");
  },

  async assignRole(env: Bindings, userId: string, role: UserRole) {
    const db = createDb(env.DB);
    const user = await usersRepository.findById(db, userId);
    if (!user) throw new HttpError(404, "user_not_found");
    return usersRepository.assignRole(db, userId, role);
  },

  async suspend(env: Bindings, userId: string) {
    const db = createDb(env.DB);
    const user = await usersRepository.findById(db, userId);
    if (!user) throw new HttpError(404, "user_not_found");
    await usersRepository.suspend(db, userId);
  },

  /** R2 key sabit ("avatars/{userId}") — her yükleme öncekini eziyor, ayrı bir
   * kolon/temizlik gerekmiyor. avatarUrl'e kendi serve endpoint'imizi (cache
   * kırmak için ?v=timestamp'li) yazıyoruz ki mevcut <img src={avatarUrl}>
   * kullanımı (Sidebar vb.) hiç değişmeden çalışsın. */
  async uploadAvatar(env: Bindings, userId: string, file: { mimeType: string; body: ArrayBuffer }) {
    const db = createDb(env.DB);
    await env.BUCKET.put(avatarR2Key(userId), file.body, { httpMetadata: { contentType: file.mimeType } });
    const avatarUrl = `/api/users/${userId}/avatar?v=${Date.now()}`;
    await usersRepository.updateAvatarUrl(db, userId, avatarUrl);
    return usersRepository.findById(db, userId);
  },

  async getAvatarObject(env: Bindings, userId: string) {
    return env.BUCKET.get(avatarR2Key(userId));
  },

  // Google hesap adı bazen mağaza/cihaz adı gibi profesyonel olmayan bir
  // değer taşıyabiliyor ("vefa phone" gibi) — Google'dan "daha doğru" bir
  // alan yok (name zaten Google'ın kendi userinfo.name'i), bu yüzden
  // kullanıcının kendi görünen adını düzeltebilmesi gerekiyordu.
  async updateOwnName(env: Bindings, userId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new HttpError(422, "name_required");
    if (trimmed.length > 100) throw new HttpError(422, "name_too_long");
    return usersRepository.updateName(createDb(env.DB), userId, trimmed);
  },

  // E-posta değişikliği doğrulamalı: kod yeni adrese gidiyor, sadece o adrese
  // erişimi olan kişi (kod) girip onaylayabiliyor. Aynı anda tek aktif istek
  // olur (repository yeni istekte eskisini siliyor).
  async requestEmailChange(env: Bindings, userId: string, newEmail: string) {
    const trimmed = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) throw new HttpError(422, "invalid_email");

    const db = createDb(env.DB);
    const user = await usersRepository.findById(db, userId);
    if (!user) throw new HttpError(404, "user_not_found");
    if (trimmed === user.email) throw new HttpError(422, "email_unchanged");

    const existing = await usersRepository.findByEmail(db, trimmed);
    if (existing) throw new HttpError(409, "email_already_in_use");

    const pending = await emailChangeRequestsRepository.findLatestForUser(db, userId);
    if (pending && Date.now() - pending.createdAt.getTime() < EMAIL_CODE_RESEND_COOLDOWN_MS) {
      throw new HttpError(429, "too_many_requests");
    }

    const code = generateEmailCode();
    await emailChangeRequestsRepository.create(db, {
      userId,
      newEmail: trimmed,
      code,
      expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
    });

    await sendEmail(env, {
      to: trimmed,
      subject: "RubriX - E-posta doğrulama kodu",
      html: `<p>RubriX hesabınızın e-posta adresini bu adrese değiştirmek için doğrulama kodunuz:</p>
             <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
             <p>Bu kod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız görmezden gelebilirsiniz.</p>`,
    });
  },

  async confirmEmailChange(env: Bindings, userId: string, code: string) {
    const db = createDb(env.DB);
    const pending = await emailChangeRequestsRepository.findLatestForUser(db, userId);
    if (!pending) throw new HttpError(404, "no_pending_email_change");
    if (pending.expiresAt.getTime() < Date.now()) {
      await emailChangeRequestsRepository.deleteForUser(db, userId);
      throw new HttpError(410, "code_expired");
    }
    if (pending.code !== code.trim()) throw new HttpError(422, "invalid_code");

    const existing = await usersRepository.findByEmail(db, pending.newEmail);
    if (existing) throw new HttpError(409, "email_already_in_use");

    const user = await usersRepository.updateEmail(db, userId, pending.newEmail);
    await emailChangeRequestsRepository.deleteForUser(db, userId);
    return user;
  },

  listRoleAllowlist(env: Bindings) {
    return roleAllowlistRepository.list(createDb(env.DB));
  },

  addToRoleAllowlist(env: Bindings, email: string, role: RoleAllowlistRole, createdBy: string) {
    if (!email.trim()) throw new HttpError(422, "email_required");
    return roleAllowlistRepository.add(createDb(env.DB), { email, role, createdBy });
  },

  removeFromRoleAllowlist(env: Bindings, id: string) {
    return roleAllowlistRepository.remove(createDb(env.DB), id);
  },
};

function avatarR2Key(userId: string) {
  return `avatars/${userId}`;
}
