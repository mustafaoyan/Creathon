import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { USER_ROLES, ROLE_ALLOWLIST_ROLES, type UserRole, type RoleAllowlistRole } from "../../shared/db/schema";
import { usersService } from "./users.service";

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.use("*", requireAuth);

// Eğitmenin sınav atarken öğrenci seçebilmesi için — tam liste değil, sadece
// aktif öğrenciler (isim/e-posta). Hesap yönetimi hâlâ sadece admin'de.
usersRoutes.get("/students", requireRole("instructor", "admin"), async (c) => {
  return c.json({ students: await usersService.listStudents(c.env) });
});

// Profil fotoğrafı: herkes sadece kendi fotoğrafını değiştirebilir, ama
// herkesin fotoğrafını görebilir (Sidebar/nav'da başkasının adı-avatarı
// göründüğü yerler için — düşük hassasiyetli, admin-only olmasına gerek yok).
usersRoutes.patch("/me", async (c) => {
  const { name } = await c.req.json<{ name?: string }>();
  if (typeof name !== "string") throw new HttpError(422, "name_required");
  const user = await usersService.updateOwnName(c.env, c.get("userId"), name);
  return c.json({ user });
});

usersRoutes.post("/me/avatar", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) throw new HttpError(400, "file_required");
  if (!file.type.startsWith("image/")) throw new HttpError(422, "image_file_required");

  const user = await usersService.uploadAvatar(c.env, c.get("userId"), {
    mimeType: file.type,
    body: await file.arrayBuffer(),
  });
  return c.json({ user });
});

usersRoutes.get("/:id/avatar", async (c) => {
  const object = await usersService.getAvatarObject(c.env, c.req.param("id"));
  if (!object) throw new HttpError(404, "avatar_not_found");
  return new Response(object.body, {
    headers: { "content-type": object.httpMetadata?.contentType ?? "application/octet-stream" },
  });
});

// Aşağıdakiler sadece Eğitim Yöneticisi (admin) — hesap yönetimi.
usersRoutes.get("/", requireRole("admin"), async (c) => {
  return c.json({ users: await usersService.list(c.env) });
});

usersRoutes.patch("/:id/role", requireRole("admin"), async (c) => {
  const { role } = await c.req.json<{ role: string }>();
  if (!USER_ROLES.includes(role as UserRole)) {
    throw new HttpError(422, "invalid_role");
  }

  const user = await usersService.assignRole(c.env, c.req.param("id"), role as UserRole);
  return c.json({ user });
});

usersRoutes.post("/:id/suspend", requireRole("admin"), async (c) => {
  await usersService.suspend(c.env, c.req.param("id"));
  return c.json({ ok: true });
});

// content_creator/instructor self-servisini kişi bazlı sınırlayan izin
// listesi — sadece admin yönetiyor. student/admin bu listeye dahil değil
// (student açık, admin ADMIN_INVITE_CODE ile korunuyor).
usersRoutes.get("/role-allowlist", requireRole("admin"), async (c) => {
  return c.json({ entries: await usersService.listRoleAllowlist(c.env) });
});

usersRoutes.post("/role-allowlist", requireRole("admin"), async (c) => {
  const { email, role } = await c.req.json<{ email: string; role: string }>();
  if (!email || !ROLE_ALLOWLIST_ROLES.includes(role as RoleAllowlistRole)) {
    throw new HttpError(422, "email_and_valid_role_required");
  }
  const id = await usersService.addToRoleAllowlist(c.env, email, role as RoleAllowlistRole, c.get("userId"));
  return c.json({ id }, 201);
});

usersRoutes.delete("/role-allowlist/:id", requireRole("admin"), async (c) => {
  await usersService.removeFromRoleAllowlist(c.env, c.req.param("id"));
  return c.json({ ok: true });
});
