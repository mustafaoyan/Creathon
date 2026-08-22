export type Page<T> = {
  items: T[];
  limit: number;
  offset: number;
  total: number;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query: { limit?: string; offset?: string }) {
  const limit = Math.min(Number(query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}
