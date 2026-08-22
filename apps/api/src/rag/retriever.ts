import { inArray } from "drizzle-orm";
import type { Database } from "../shared/db/client";
import { documentChunks } from "../shared/db/schema";
import type { EmbeddingsPort } from "../ai/ports/embeddings.port";
import type { VectorizeClient } from "./vectorize-client";

const DEFAULT_TOP_K = 8;

/** Embeds the query, finds nearest chunks in Vectorize, hydrates their text from D1.
 * This is the only grounding source handed to the question generator. */
export async function retrieveRelevantChunks(params: {
  db: Database;
  embeddings: EmbeddingsPort;
  vectorize: VectorizeClient;
  queryText: string;
  topK?: number;
}): Promise<{ id: string; content: string }[]> {
  const [queryVector] = await params.embeddings.embed([params.queryText]);
  if (!queryVector) return [];

  const matches = await params.vectorize.queryTopK(queryVector, params.topK ?? DEFAULT_TOP_K);

  if (matches.length === 0) return [];

  const chunkIds = matches.map((match) => match.metadata.chunkId);
  return params.db
    .select({ id: documentChunks.id, content: documentChunks.content })
    .from(documentChunks)
    .where(inArray(documentChunks.id, chunkIds));
}
