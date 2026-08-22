import type { Bindings } from "../config/env";

export type ChunkVectorMetadata = { documentId: string; chunkId: string };

export class VectorizeClient {
  constructor(private env: Bindings) {}

  async upsertChunks(vectors: { id: string; values: number[]; metadata: ChunkVectorMetadata }[]) {
    await this.env.VECTORIZE.upsert(vectors);
  }

  async queryTopK(vector: number[], topK: number) {
    const result = await this.env.VECTORIZE.query(vector, { topK, returnMetadata: true });
    return result.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as unknown as ChunkVectorMetadata,
    }));
  }
}
