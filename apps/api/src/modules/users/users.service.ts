import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { usersRepository, roleAllowlistRepository } from "./users.repository";
import type { UserRole, RoleAllowlistRole } from "../../shared/db/schema";
import { HttpError } from "../../shared/middleware/error-handler";

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
