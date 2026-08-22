const CHUNK_SIZE = 1200; // characters
const CHUNK_OVERLAP = 150;

/** Naive sliding-window chunker. Good enough for MVP grounding; swap for a
 * sentence-aware splitter later without touching any caller. */
export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    chunks.push(cleaned.slice(start, end));
    if (end === cleaned.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}
