import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { questionsService } from "./questions.service";
import type { QuestionStatus } from "../../shared/db/schema";

export const questionsRoutes = new Hono<AppEnv>();

questionsRoutes.use("*", requireAuth);

// İçerik Uzmanı: kaynak + kazanımdan RAG ile soru taslağı üretir (henüz havuza inmez).
questionsRoutes.post("/generate", requireRole("content_creator"), async (c) => {
  const body = await c.req.json<{
    documentId: string;
    learningOutcomeId: string;
    rubricId?: string;
    multipleChoiceCount?: number;
    openEndedCount?: number;
  }>();

  if (!body.documentId || !body.learningOutcomeId) {
    throw new HttpError(422, "documentId_and_learningOutcomeId_required");
  }

  const generationJobId = await questionsService.generate(c.env, {
    documentId: body.documentId,
    learningOutcomeId: body.learningOutcomeId,
    rubricId: body.rubricId ?? null,
    requestedBy: c.get("userId"),
    multipleChoiceCount: body.multipleChoiceCount ?? 3,
    openEndedCount: body.openEndedCount ?? 2,
  });

  return c.json({ generationJobId }, 202);
});

questionsRoutes.get("/", requireRole("content_creator", "instructor", "admin"), async (c) => {
  const status = c.req.query("status") as QuestionStatus | undefined;
  return c.json({ questions: await questionsService.list(c.env, status) });
});

// İçerik uzmanı/eğitmen taslağı düzenleyip onaylar/reddeder — havuza sadece onaylı sorular düşer.
questionsRoutes.patch("/:id", requireRole("content_creator", "instructor"), async (c) => {
  const { body } = await c.req.json<{ body: string }>();
  if (!body) throw new HttpError(422, "body_required");
  await questionsService.update(c.env, c.req.param("id"), body);
  return c.json({ ok: true });
});

// Brif'e göre AI taslağını onaylama/reddetme sadece İçerik Uzmanı'nın yetkisi —
// eğitmen havuzu düzenleyebilir (üstteki PATCH) ama onay kararını vermez.
questionsRoutes.post("/:id/approve", requireRole("content_creator"), async (c) => {
  await questionsService.review(c.env, c.req.param("id"), "approved", c.get("userId"));
  return c.json({ ok: true });
});

questionsRoutes.post("/:id/reject", requireRole("content_creator"), async (c) => {
  await questionsService.review(c.env, c.req.param("id"), "rejected", c.get("userId"));
  return c.json({ ok: true });
});
