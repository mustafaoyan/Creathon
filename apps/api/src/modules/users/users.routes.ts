import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { USER_ROLES, type UserRole } from "../../shared/db/schema";
import { usersService } from "./users.service";

export const usersRoutes = new Hono<AppEnv>();

// Only the Eğitim Yöneticisi (admin) manages accounts and role assignment.
usersRoutes.use("*", requireAuth, requireRole("admin"));

usersRoutes.get("/", async (c) => {
  return c.json({ users: await usersService.list(c.env) });
});

usersRoutes.patch("/:id/role", async (c) => {
  const { role } = await c.req.json<{ role: string }>();
  if (!USER_ROLES.includes(role as UserRole)) {
    throw new HttpError(422, "invalid_role");
  }

  const user = await usersService.assignRole(c.env, c.req.param("id"), role as UserRole);
  return c.json({ user });
});

usersRoutes.post("/:id/suspend", async (c) => {
  await usersService.suspend(c.env, c.req.param("id"));
  return c.json({ ok: true });
});
