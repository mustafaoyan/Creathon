import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { questionsService } from "./questions.service";
import { examsService } from "../exams/exams.service";
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

  const generationJobId = await questionsService.enqueueGeneration(c.env, {
    documentId: body.documentId,
    learningOutcomeId: body.learningOutcomeId,
    rubricId: body.rubricId ?? null,
    requestedBy: c.get("userId"),
    multipleChoiceCount: body.multipleChoiceCount ?? 3,
    openEndedCount: body.openEndedCount ?? 2,
  });

  return c.json({ generationJobId }, 202);
});

// Frontend'in ilerleme/tamamlanma durumunu göstermesi için — sayfayı tekrar
// açtığında da (parametresiz) en son işini bulup gösterebilir.
questionsRoutes.get("/generate/:jobId", requireRole("content_creator"), async (c) => {
  return c.json(await questionsService.getGenerationJob(c.env, c.req.param("jobId")));
});

questionsRoutes.get("/generate-status/latest", requireRole("content_creator"), async (c) => {
  const job = await questionsService.getLatestGenerationJobFor(c.env, c.get("userId"));
  return c.json({ job });
});

questionsRoutes.post("/generate/:jobId/cancel", requireRole("content_creator"), async (c) => {
  await questionsService.cancelGenerationJob(c.env, c.req.param("jobId"), c.get("userId"));
  return c.json({ ok: true });
});

questionsRoutes.get("/", requireRole("content_creator", "instructor", "admin"), async (c) => {
  const status = c.req.query("status") as QuestionStatus | undefined;
  return c.json({ questions: await questionsService.list(c.env, status) });
});

// İçerik uzmanı/eğitmen taslağı düzenleyip onaylar/reddeder — havuza sadece onaylı sorular düşer.
// rubricId de buradan atanabiliyor — açık uçlu bir soru rubriksiz onaylanmışsa
// (onay anındaki kontrolden önce geçmiş eski sorular gibi) sonradan düzeltilebilsin.
questionsRoutes.patch("/:id", requireRole("content_creator", "instructor"), async (c) => {
  const body = await c.req.json<{ body?: string; rubricId?: string | null }>();
  if (body.body === undefined && body.rubricId === undefined) throw new HttpError(422, "body_or_rubricId_required");
  await questionsService.update(c.env, c.req.param("id"), body);
  return c.json({ ok: true });
});

// rubricId sonradan eklendiğinde, o soruya daha önce verilmiş ama hiç
// değerlendirilmemiş cevapları geriye dönük puanlar.
questionsRoutes.post("/:id/regrade", requireRole("content_creator", "instructor"), async (c) => {
  return c.json(await examsService.regradeAnswersForQuestion(c.env, c.req.param("id")));
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
