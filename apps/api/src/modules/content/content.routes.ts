import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { contentService } from "./content.service";

export const contentRoutes = new Hono<AppEnv>();

contentRoutes.use("*", requireAuth);

// Only the İçerik Uzmanı authors source material and learning outcomes.
contentRoutes.post("/documents", requireRole("content_creator"), async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  const title = body["title"];

  if (!(file instanceof File) || typeof title !== "string" || !title) {
    throw new HttpError(400, "file_and_title_required");
  }

  const documentId = await contentService.uploadDocument(c.env, {
    uploadedBy: c.get("userId"),
    title,
    mimeType: file.type || "application/octet-stream",
    body: await file.arrayBuffer(),
  });

  return c.json({ id: documentId }, 201);
});

contentRoutes.get("/documents", requireRole("content_creator", "instructor", "admin"), async (c) => {
  return c.json({ documents: await contentService.listDocuments(c.env) });
});

contentRoutes.post("/learning-outcomes", requireRole("content_creator"), async (c) => {
  const payload = await c.req.json<{ documentId?: string; title: string; description?: string }>();
  if (!payload.title) throw new HttpError(422, "title_required");

  const id = await contentService.createLearningOutcome(c.env, {
    documentId: payload.documentId ?? null,
    title: payload.title,
    description: payload.description ?? null,
    createdBy: c.get("userId"),
  });

  return c.json({ id }, 201);
});

contentRoutes.get(
  "/learning-outcomes",
  requireRole("content_creator", "instructor", "admin"),
  async (c) => {
    return c.json({ learningOutcomes: await contentService.listLearningOutcomes(c.env) });
  },
);
