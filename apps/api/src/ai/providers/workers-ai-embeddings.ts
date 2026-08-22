import type { Bindings } from "../../config/env";
import type { EmbeddingsPort } from "../ports/embeddings.port";

const EMBEDDING_MODEL = "@cf/baai/bge-m3"; // multilingual — required for Turkish source content

export class WorkersAiEmbeddings implements EmbeddingsPort {
  constructor(private env: Bindings) {}

  async embed(texts: string[]): Promise<number[][]> {
    const result = await this.env.AI.run(EMBEDDING_MODEL, { text: texts });
    return (result as { data: number[][] }).data;
  }
}
