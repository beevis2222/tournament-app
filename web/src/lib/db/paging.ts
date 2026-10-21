export const PAGE_SIZE = 1000;

type Page<T> = { data: T[] | null; error: { message: string } | null };

/**
 * PostgREST returns at most 1000 rows per request. Calls fetchPage(from, to) for
 * successive ranges until a page comes back short, and returns every row.
 * The query behind fetchPage must have a stable order.
 */
export async function fetchAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = PAGE_SIZE,
): Promise<Page<T>> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    all.push(...page);
    if (page.length < pageSize) return { data: all, error: null };
  }
}
