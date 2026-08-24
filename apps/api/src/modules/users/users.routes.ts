import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { USER_ROLES, type UserRole } from "../../shared/db/schema";
import { usersService } from "./users.service";

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.use("*", requireAuth);

// Eğitmenin sınav atarken öğrenci seçebilmesi için — tam liste değil, sadece
// aktif öğrenciler (isim/e-posta). Hesap yönetimi hâlâ sadece admin'de.
usersRoutes.get("/students", requireRole("instructor", "admin"), async (c) => {
  return c.json({ students: await usersService.listStudents(c.env) });
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
