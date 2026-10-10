/**
 * Read every row of a PostgREST query, 1,000 at a time (Supabase caps a single
 * response at 1,000 rows and silently truncates beyond that).
 *
 * The builder must apply a stable `.order(...)` — offset paging over an
 * unordered query can repeat or skip rows between pages. Throws on any page
 * error so a partial read is never mistaken for the full set.
 */
export async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    // Stop on an empty page, not a short one: if the server's max-rows is below pageSize every page is
    // "short", and treating that as the end would silently truncate. Costs one extra empty request.
    if (!data || data.length === 0) return out;
  }
}
