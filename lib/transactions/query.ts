/**
 * Server-side helpers shared by GET /api/transactions and
 * GET /api/transactions/ids: parse the list query string and apply the same
 * filters to any supabase-js query builder.
 */
import { supabaseAdmin } from '@/lib/supabase/server';
import { transactionQuerySchema, type TransactionQuery } from '@/lib/validations/transactions';

/** The filter methods we use, structurally matched by supabase-js builders. */
export interface FilterableQuery<B> {
  eq(column: string, value: unknown): B;
  is(column: string, value: null): B;
  gte(column: string, value: unknown): B;
  lte(column: string, value: unknown): B;
  ilike(column: string, pattern: string): B;
}

/** Parse (and validate) the list query params. Throws ZodError when invalid. */
export function parseTransactionQuery(searchParams: URLSearchParams): TransactionQuery {
  const get = (key: string) => searchParams.get(key) || undefined;
  return transactionQuerySchema.parse({
    account_id: get('account_id'),
    category_id: get('category_id'),
    start_date: get('start_date'),
    end_date: get('end_date'),
    search: get('search'),
    limit: get('limit'),
    offset: get('offset'),
    sort_column: get('sort_column'),
    sort_direction: get('sort_direction'),
    status: get('status'),
    validated: get('validated'),
    totals: get('totals'),
  });
}

/** Apply account / category / date / search / status filters to a query. */
export function applyTransactionFilters<B extends FilterableQuery<B>>(builder: B, query: TransactionQuery): B {
  let b = builder;
  if (query.account_id) b = b.eq('account_id', query.account_id);
  if (query.category_id) b = b.eq('category_id', query.category_id);
  if (query.start_date) b = b.gte('date', query.start_date);
  if (query.end_date) b = b.lte('date', query.end_date);
  if (query.search) b = b.ilike('description', `%${query.search}%`);

  switch (query.status) {
    case 'uncategorised':
      b = b.is('category_id', null);
      break;
    case 'needs_review':
      b = b.eq('needs_review', true);
      break;
    case 'validated':
      b = b.eq('is_validated', true);
      break;
    case 'unvalidated':
      b = b.eq('is_validated', false);
      break;
  }

  // Legacy ?validated= param (ignored when a status filter already covers it).
  if (!query.status) {
    if (query.validated === 'validated') b = b.eq('is_validated', true);
    else if (query.validated === 'unvalidated') b = b.eq('is_validated', false);
  }
  return b;
}

/** PostgREST returns at most this many rows per request (Supabase max_rows). */
export const PAGE_ROWS = 1000;
/** Upper bound on rows read to compute totals (keeps a request bounded). */
const MAX_TOTAL_ROWS = 100_000;

export interface TransactionTotals {
  /** Sum of spending, as a positive number. */
  out: number;
  /** Sum of money in. */
  in: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Sum money out / in across the whole filtered set (not just the page).
 * Reads only the amount column, in parallel pages of PAGE_ROWS.
 */
export async function sumTransactionAmounts(query: TransactionQuery, count: number): Promise<TransactionTotals> {
  const rows = Math.min(count, MAX_TOTAL_ROWS);
  const pages = Math.ceil(rows / PAGE_ROWS);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      applyTransactionFilters(supabaseAdmin.from('transactions').select('amount'), query)
        .order('id', { ascending: true })
        .range(i * PAGE_ROWS, i * PAGE_ROWS + PAGE_ROWS - 1)
    )
  );

  let out = 0;
  let inn = 0;
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { amount: number | string }[]) {
      const amount = Number(row.amount);
      if (amount < 0) out -= amount;
      else inn += amount;
    }
  }
  return { out: round2(out), in: round2(inn) };
}
