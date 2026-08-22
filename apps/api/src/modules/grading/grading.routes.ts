import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { gradingService } from "./grading.service";

export const gradingRoutes = new Hono<AppEnv>();

// Human-in-the-loop: only the Eğitmen finalizes AI-suggested grades.
gradingRoutes.use("*", requireAuth, requireRole("instructor"));

gradingRoutes.get("/pending", async (c) => {
  return c.json({ pending: await gradingService.pendingReviews(c.env) });
});

gradingRoutes.post("/:studentAnswerId/finalize", async (c) => {
  const body = await c.req.json<{ score: number; overrideReason?: string }>();
  if (typeof body.score !== "number") throw new HttpError(422, "score_required");

  await gradingService.finalizeGrade(c.env, {
    studentAnswerId: c.req.param("studentAnswerId"),
    score: body.score,
    gradedBy: c.get("userId"),
    overrideReason: body.overrideReason,
  });

  return c.json({ ok: true });
});
