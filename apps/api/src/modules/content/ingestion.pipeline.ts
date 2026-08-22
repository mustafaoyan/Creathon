import { extractText, getDocumentProxy } from "unpdf";
import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { chunkText } from "../../rag/chunker";
import { VectorizeClient } from "../../rag/vectorize-client";
import { createAiServices } from "../../ai/ai.factory";
import { contentRepository } from "./content.repository";
import { newId } from "../../shared/lib/id";

/**
 * Runs off the request path (triggered by the DOC_QUEUE consumer): parses the raw file,
 * chunks it, embeds each chunk, upserts vectors into Vectorize, and persists chunk rows.
 * This is the only place that turns a raw upload into RAG-ready, grounded content.
 */
export async function processDocument(env: Bindings, documentId: string): Promise<void> {
  const db = createDb(env.DB);
  const document = await contentRepository.findDocumentById(db, documentId);
  if (!document) return;

  try {
    await contentRepository.setDocumentStatus(db, documentId, "processing");

    const object = await env.BUCKET.get(document.r2Key);
    if (!object) throw new Error("r2_object_not_found");

    const text = await extractDocumentText(document.mimeType, await object.arrayBuffer());
    const rawChunks = chunkText(text);
    if (rawChunks.length === 0) throw new Error("no_extractable_text");

    const ai = createAiServices(env);
    const vectorize = new VectorizeClient(env);
    const embeddings = await ai.embeddings.embed(rawChunks);
    if (embeddings.length !== rawChunks.length) {
      throw new Error("embedding_count_mismatch");
    }

    const chunks = rawChunks.map((content, index) => ({
      id: newId("chunk"),
      content,
      values: embeddings[index] as number[],
      index,
    }));

    await vectorize.upsertChunks(
      chunks.map((chunk) => ({
        id: chunk.id,
        values: chunk.values,
        metadata: { documentId, chunkId: chunk.id },
      })),
    );

    await contentRepository.insertChunks(
      db,
      chunks.map((chunk) => ({
        id: chunk.id,
        documentId,
        chunkIndex: chunk.index,
        content: chunk.content,
        vectorId: chunk.id,
        tokenCount: Math.ceil(chunk.content.length / 4),
      })),
    );

    await contentRepository.setDocumentStatus(db, documentId, "ready");
  } catch (error) {
    await contentRepository.setDocumentStatus(db, documentId, "failed", (error as Error).message);
  }
}

async function extractDocumentText(mimeType: string, buffer: ArrayBuffer): Promise<string> {
  if (mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  return new TextDecoder().decode(buffer);
}
