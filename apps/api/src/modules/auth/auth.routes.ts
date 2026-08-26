import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../../config/env";
import { requireAuth, SESSION_COOKIE_NAME } from "../../shared/middleware/auth";
import { HttpError } from "../../shared/middleware/error-handler";
import { createDb } from "../../shared/db/client";
import { newId } from "../../shared/lib/id";
import { USER_ROLES, type UserRole } from "../../shared/db/schema";
import { usersRepository } from "../users/users.repository";
import { authService, RoleMismatchError } from "./auth.service";

export const authRoutes = new Hono<AppEnv>();

const OAUTH_STATE_COOKIE = "rubrix_oauth_state";
const OAUTH_REQUESTED_ROLE_COOKIE = "rubrix_oauth_requested_role";
const POST_LOGIN_REDIRECT = "/"; // SSR web app is served same-origin behind the same domain

const REQUESTABLE_ROLES: UserRole[] = ["content_creator", "instructor", "student", "admin"];

authRoutes.get("/google", (c) => {
  const requestedRole = c.req.query("role");

  // "admin" self-servis ama korumasız değil — gizli bir davet kodu gerekiyor,
  // sadece kodu bilenler tek tıkla Eğitim Yöneticisi olabiliyor. Google'a hiç
  // gitmeden burada reddediyoruz ki yanlış/eksik kodla boşuna OAuth turu olmasın.
  if (
    requestedRole === "admin" &&
    (!c.env.ADMIN_INVITE_CODE || c.req.query("code") !== c.env.ADMIN_INVITE_CODE)
  ) {
    throw new HttpError(403, "invalid_admin_code");
  }

  const state = newId("state");
  const cookieOpts = {
    httpOnly: true,
    maxAge: 600,
    sameSite: "Lax" as const,
    secure: c.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
  };

  setCookie(c, OAUTH_STATE_COOKIE, state, cookieOpts);
  if (requestedRole && REQUESTABLE_ROLES.includes(requestedRole as UserRole)) {
    setCookie(c, OAUTH_REQUESTED_ROLE_COOKIE, requestedRole, cookieOpts);
  } else {
    deleteCookie(c, OAUTH_REQUESTED_ROLE_COOKIE, { path: "/" });
  }

  return c.redirect(authService.buildLoginUrl(c.env, state));
});

authRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    throw new HttpError(400, "invalid_oauth_state");
  }

  const requestedRoleCookie = getCookie(c, OAUTH_REQUESTED_ROLE_COOKIE);
  const requestedRole =
    requestedRoleCookie && USER_ROLES.includes(requestedRoleCookie as UserRole)
      ? (requestedRoleCookie as UserRole)
      : null;

  let sessionId: string;
  try {
    ({ sessionId } = await authService.handleGoogleCallback(c.env, code, requestedRole));
  } catch (error) {
    // Bu bir tarayıcı yönlendirmesi (Google buraya redirect ediyor) — ham bir
    // JSON hata sayfası göstermek yerine giriş ekranına, kullanıcının
    // anlayacağı bir mesajla geri dönüyoruz.
    if (error instanceof RoleMismatchError) {
      deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
      deleteCookie(c, OAUTH_REQUESTED_ROLE_COOKIE, { path: "/" });
      return c.redirect(`/login?authError=role_mismatch&actualRole=${error.actualRole}`);
    }
    throw error;
  }
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
  deleteCookie(c, OAUTH_REQUESTED_ROLE_COOKIE, { path: "/" });
  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: c.env.SESSION_COOKIE_SECURE === "true",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return c.redirect(POST_LOGIN_REDIRECT);
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionId) await authService.destroySession(c.env, sessionId);
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = await usersRepository.findById(createDb(c.env.DB), c.get("userId"));
  return c.json({ user });
});
