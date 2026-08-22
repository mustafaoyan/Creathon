import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { reportingService } from "./reporting.service";

export const reportingRoutes = new Hono<AppEnv>();

reportingRoutes.use("*", requireAuth);

// Eğitim Yöneticisi: tüm sistemin sınav tamamlanma oranı + AI başarı istatistikleri.
reportingRoutes.get("/dashboard", requireRole("admin"), async (c) => {
  return c.json(await reportingService.dashboard(c.env));
});

reportingRoutes.get("/students/:id/outcomes", requireRole("admin", "instructor", "student"), async (c) => {
  const targetId = c.req.param("id");
  if (c.get("userRole") === "student" && c.get("userId") !== targetId) {
    throw new HttpError(403, "forbidden");
  }
  return c.json({ outcomes: await reportingService.studentOutcomeBreakdown(c.env, targetId) });
});
