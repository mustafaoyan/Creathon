import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { contentRepository } from "./content.repository";
import { newId } from "../../shared/lib/id";
import type { OutcomeLevel } from "../../shared/db/schema";

export const contentService = {
  async uploadDocument(env: Bindings, params: { uploadedBy: string; title: string; mimeType: string; body: ArrayBuffer }) {
    const db = createDb(env.DB);
    const r2Key = `documents/${newId("doc")}`;

    await env.BUCKET.put(r2Key, params.body, { httpMetadata: { contentType: params.mimeType } });

    const documentId = await contentRepository.createDocument(db, {
      uploadedBy: params.uploadedBy,
      title: params.title,
      r2Key,
      mimeType: params.mimeType,
    });

    // Heavy parse/chunk/embed work happens off the request path.
    await env.DOC_QUEUE.send({ documentId });

    return documentId;
  },

  listDocuments(env: Bindings) {
    return contentRepository.listDocuments(createDb(env.DB));
  },

  createLearningOutcome(
    env: Bindings,
    data: {
      documentId?: string | null;
      title: string;
      description?: string | null;
      topic?: string | null;
      level?: OutcomeLevel | null;
      createdBy: string;
    },
  ) {
    return contentRepository.createLearningOutcome(createDb(env.DB), data);
  },

  listLearningOutcomes(env: Bindings) {
    return contentRepository.listLearningOutcomes(createDb(env.DB));
  },
};
