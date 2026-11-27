export function filterRows<T>(
  rows: T[],
  query: string,
  predicates: Array<(row: T) => boolean> = []
): T[] {
  const q = (query || '').trim().toLowerCase();
  return (rows || []).filter((row) => {
    for (const pred of predicates) {
      if (!pred(row)) return false;
    }
    if (!q) return true;
    return Object.values(row as Record<string, unknown>).some((v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        return String(v).toLowerCase().includes(q);
      }
      if (Array.isArray(v)) {
        return v.join(' ').toLowerCase().includes(q);
      }
      return false;
    });
  });
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const totalPages = Math.max(1, Math.ceil(rows.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
