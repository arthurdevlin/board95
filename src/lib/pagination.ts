export type PageParam = string | string[] | undefined;

export function parsePageParam(value: PageParam): number {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || !/^\d+$/.test(first)) return 1;
  return Math.max(1, Math.min(100_000, Number(first)));
}

// Count and read concurrently. Only stale, out-of-range links need a second read.
export async function readPage<T>(
  requestedPage: number,
  pageSize: number,
  count: () => Promise<number>,
  read: (skip: number, take: number) => Promise<T[]>,
) {
  const [total, initialRows] = await Promise.all([
    count(),
    read((requestedPage - 1) * pageSize, pageSize),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const rows = page === requestedPage ? initialRows : await read((page - 1) * pageSize, pageSize);
  return { rows, total, page, pageCount };
}
