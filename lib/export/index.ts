/**
 * Data export helpers shared by /api/export/*: CSV escaping, paged reads
 * and the list of tables included in the full JSON export.
 */

/** Rows fetched per request (PostgREST caps responses at 1000). */
export const EXPORT_PAGE_SIZE = 1000;

/**
 * Tables in "Download all data". Connection tokens, sessions, import hashes
 * and AI caches are left out: they are either secrets or rebuildable.
 */
export const EXPORT_TABLES = [
  'accounts',
  'category_groups',
  'categories',
  'category_mappings',
  'budgets',
  'transactions',
  'wealth_snapshots',
  'investment_valuations',
  'subscriptions',
  'subscription_exclusions',
  'planning_sections',
  'planning_notes',
  'fire_inputs',
  'fire_parameters',
  'fire_scenarios',
  'import_formats',
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

/** Quote a CSV field when it holds a comma, quote or newline. Neutralises spreadsheet formulas. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // A leading =, +, -, @ makes Excel/Sheets treat text as a formula. Numbers are left alone.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvField).join(',') + '\r\n';
}

/** ISO date (YYYY-MM-DD) check for the optional from/to filters. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

type PageResult = { data: unknown[] | null; error: { message: string } | null };

/** Read a query page by page until a short page comes back. */
export async function* pages(fetchPage: (from: number, to: number) => PromiseLike<PageResult>) {
  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + EXPORT_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length > 0) yield rows as Record<string, unknown>[];
    if (rows.length < EXPORT_PAGE_SIZE) return;
  }
}

/** Today's date (UTC) for file names. */
export function stamp(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
