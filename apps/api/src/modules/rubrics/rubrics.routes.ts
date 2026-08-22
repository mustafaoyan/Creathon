import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { rubricsService } from "./rubrics.service";

export const rubricsRoutes = new Hono<AppEnv>();

rubricsRoutes.use("*", requireAuth, requireRole("content_creator", "instructor", "admin"));

rubricsRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    title: string;
    maxScore?: number;
    criteria: { criterion: string; description?: string; weight: number }[];
  }>();

  if (!body.title || !body.criteria?.length) {
    throw new HttpError(422, "title_and_criteria_required");
  }

  const id = await rubricsService.create(c.env, {
    title: body.title,
    maxScore: body.maxScore ?? 100,
    createdBy: c.get("userId"),
    criteria: body.criteria,
  });

  return c.json({ id }, 201);
});

rubricsRoutes.get("/", async (c) => {
  return c.json({ rubrics: await rubricsService.list(c.env) });
});

rubricsRoutes.get("/:id", async (c) => {
  return c.json(await rubricsService.getWithCriteria(c.env, c.req.param("id")));
});
