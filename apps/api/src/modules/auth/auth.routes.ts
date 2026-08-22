import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../../config/env";
import { requireAuth, SESSION_COOKIE_NAME } from "../../shared/middleware/auth";
import { HttpError } from "../../shared/middleware/error-handler";
import { createDb } from "../../shared/db/client";
import { newId } from "../../shared/lib/id";
import { usersRepository } from "../users/users.repository";
import { authService } from "./auth.service";

export const authRoutes = new Hono<AppEnv>();

const OAUTH_STATE_COOKIE = "rubrix_oauth_state";
const POST_LOGIN_REDIRECT = "/"; // SSR web app is served same-origin behind the same domain

authRoutes.get("/google", (c) => {
  const state = newId("state");
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "Lax",
    secure: c.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
  });
  return c.redirect(authService.buildLoginUrl(c.env, state));
});

authRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    throw new HttpError(400, "invalid_oauth_state");
  }

  const { sessionId } = await authService.handleGoogleCallback(c.env, code);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
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
