import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { examsService } from "./exams.service";

export const examsRoutes = new Hono<AppEnv>();

examsRoutes.use("*", requireAuth);

examsRoutes.get("/", requireRole("instructor"), async (c) => {
  return c.json({ exams: await examsService.list(c.env) });
});

examsRoutes.post("/", requireRole("instructor"), async (c) => {
  const body = await c.req.json<{
    title: string;
    durationMinutes?: number;
    questionIds: { questionId: string; points: number }[];
    allowedEmails?: string[];
  }>();

  if (!body.title || !body.questionIds?.length) {
    throw new HttpError(422, "title_and_questionIds_required");
  }

  const id = await examsService.create(c.env, {
    title: body.title,
    createdBy: c.get("userId"),
    durationMinutes: body.durationMinutes,
    questionIds: body.questionIds,
    allowedEmails: body.allowedEmails,
  });

  return c.json({ id }, 201);
});

// Eğitmenin sonuçlar ekranı: sınava giren her öğrenci ayrı, isme tıklayınca
// cevapları + AI değerlendirmeleri.
examsRoutes.get("/:id/results", requireRole("instructor"), async (c) => {
  return c.json({ results: await examsService.resultsForExam(c.env, c.req.param("id")) });
});

examsRoutes.get("/:id/results/:studentId", requireRole("instructor"), async (c) => {
  return c.json({
    answers: await examsService.studentAnswersForExam(c.env, c.req.param("id"), c.req.param("studentId")),
  });
});

examsRoutes.post("/:id/publish", requireRole("instructor"), async (c) => {
  await examsService.publish(c.env, c.req.param("id"));
  return c.json({ ok: true });
});

examsRoutes.post("/:id/assign", requireRole("instructor"), async (c) => {
  const { studentIds } = await c.req.json<{ studentIds: string[] }>();
  if (!studentIds?.length) throw new HttpError(422, "studentIds_required");
  await examsService.assignStudents(c.env, c.req.param("id"), studentIds);
  return c.json({ ok: true });
});

examsRoutes.get("/my", requireRole("student"), async (c) => {
  return c.json({ assignments: await examsService.listForStudent(c.env, c.get("userId")) });
});

examsRoutes.post("/:id/attempts", requireRole("student"), async (c) => {
  return c.json(await examsService.startAttempt(c.env, c.req.param("id"), c.get("userId")));
});

examsRoutes.post("/attempts/:attemptId/answers", requireRole("student"), async (c) => {
  const body = await c.req.json<{ questionId: string; selectedOptionId?: string; answerText?: string }>();
  if (!body.questionId) throw new HttpError(422, "questionId_required");
  await examsService.answer(c.env, c.req.param("attemptId"), body);
  return c.json({ ok: true });
});

examsRoutes.post("/:id/attempts/:attemptId/submit", requireRole("student"), async (c) => {
  return c.json(await examsService.submit(c.env, c.req.param("id"), c.req.param("attemptId")));
});
