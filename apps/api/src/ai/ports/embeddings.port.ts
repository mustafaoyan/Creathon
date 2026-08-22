export interface EmbeddingsPort {
  embed(texts: string[]): Promise<number[][]>;
}
