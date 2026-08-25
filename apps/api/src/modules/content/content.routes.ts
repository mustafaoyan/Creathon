import { Hono } from "hono";
import type { AppEnv } from "../../config/env";
import { requireAuth } from "../../shared/middleware/auth";
import { requireRole } from "../../shared/middleware/rbac";
import { HttpError } from "../../shared/middleware/error-handler";
import { contentService } from "./content.service";
import { OUTCOME_LEVELS, type OutcomeLevel } from "../../shared/db/schema";

export const contentRoutes = new Hono<AppEnv>();

contentRoutes.use("*", requireAuth);

// İşlem hattı (ingestion.pipeline.ts) sadece PDF'i gerçekten ayrıştırıyor (unpdf);
// diğer her şey ham metin olarak decode ediliyor — bu yüzden fiilen sadece
// düz metin barındıran dosyalar (txt/md) + PDF anlamlı sonuç veriyor, DOCX gibi
// ikili formatlar "desteklenmiyor" (decode edilse de anlamsız çıktı verir).
export const SUPPORTED_DOCUMENT_MIME_TYPES = ["application/pdf", "text/plain", "text/markdown"] as const;
export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

// Only the İçerik Uzmanı authors source material and learning outcomes.
contentRoutes.post("/documents", requireRole("content_creator"), async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  const title = body["title"];

  if (!(file instanceof File) || typeof title !== "string" || !title) {
    throw new HttpError(400, "file_and_title_required");
  }
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new HttpError(422, "file_too_large");
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
  const payload = await c.req.json<{
    documentId?: string;
    title: string;
    description?: string;
    topic?: string;
    level?: string;
  }>();
  if (!payload.title) throw new HttpError(422, "title_required");
  if (payload.level && !OUTCOME_LEVELS.includes(payload.level as OutcomeLevel)) {
    throw new HttpError(422, "invalid_level");
  }

  const id = await contentService.createLearningOutcome(c.env, {
    documentId: payload.documentId ?? null,
    title: payload.title,
    description: payload.description ?? null,
    topic: payload.topic ?? null,
    level: (payload.level as OutcomeLevel) ?? null,
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
