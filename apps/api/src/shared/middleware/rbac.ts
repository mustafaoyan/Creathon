import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../config/env";
import type { UserRole } from "../db/schema";
import { HttpError } from "./error-handler";

/** Requires `requireAuth` to run first so `userRole` is populated. */
export function requireRole(...roles: UserRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("userRole");
    if (!role || !roles.includes(role as UserRole)) {
      throw new HttpError(403, "forbidden");
    }
    await next();
  });
}
