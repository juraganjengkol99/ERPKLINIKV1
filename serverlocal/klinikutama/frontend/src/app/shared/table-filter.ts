export function filterRows<T>(rows: T[], query: string, predicates: Array<(row: T) => boolean> = []): T[] {
  const q = (query || '').trim().toLowerCase();
  return (rows || []).filter((row) => {
    for (const pred of predicates) { if (!pred(row)) return false; }
    if (!q) return true;
    return Object.values(row as Record<string, unknown>).some((v) =>
      v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(q)
    );
  });
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const totalPages = Math.max(1, Math.ceil(rows.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
