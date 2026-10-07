import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { applyTransactionFilters, parseTransactionQuery, PAGE_ROWS } from '@/lib/transactions/query';

/** Most rows one "Validate all" may touch; far above the live table today. */
const VALIDATE_MATCHING_MAX = 20000;

// Keep `.in('id', ...)` filters well inside PostgREST's URL length limit.
const CHUNK = 200;

/**
 * Not-yet-validated transactions matching the list filters (same query string
 * as GET /api/transactions). Only id is read.
 */
async function unvalidatedIds(searchParams: URLSearchParams): Promise<{ ids: string[]; total: number }> {
  const query = parseTransactionQuery(searchParams);
  const ids: string[] = [];
  let total = 0;
  for (let from = 0; from < VALIDATE_MATCHING_MAX; from += PAGE_ROWS) {
    const { data, error, count } = await applyTransactionFilters(
      supabaseAdmin.from('transactions').select('id', { count: 'exact' }),
      query
    )
      .eq('is_validated', false)
      .order('id', { ascending: true })
      .range(from, Math.min(from + PAGE_ROWS, VALIDATE_MATCHING_MAX) - 1);
    if (error) throw new Error(error.message);
    if (from === 0) total = count ?? 0;
    const rows = (data ?? []) as { id: string }[];
    ids.push(...rows.map((r) => r.id));
    if (rows.length < PAGE_ROWS) break;
  }
  return { ids, total: Math.max(total, ids.length) };
}

/**
 * GET /api/transactions/validate-matching?<list filters>
 * How many matching transactions are not validated yet → { count }.
 */
export async function GET(request: NextRequest) {
  try {
    const query = parseTransactionQuery(request.nextUrl.searchParams);
    const { count, error } = await applyTransactionFilters(
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }),
      query
    ).eq('is_validated', false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: count ?? 0 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('GET /api/transactions/validate-matching error:', error);
    return NextResponse.json({ error: 'Failed to count transactions to validate' }, { status: 500 });
  }
}

/**
 * POST /api/transactions/validate-matching?<list filters>
 * Marks every matching, not-yet-validated transaction as validated.
 * → { updated, ids, capped } — ids are the rows changed, for Undo.
 */
export async function POST(request: NextRequest) {
  try {
    const { ids, total } = await unvalidatedIds(request.nextUrl.searchParams);

    const changed: string[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update({ is_validated: true })
        .in('id', ids.slice(i, i + CHUNK))
        .eq('is_validated', false)
        .select('id');
      if (error) {
        // Report what already went through so the client can still undo it.
        return NextResponse.json({ error: error.message, updated: changed.length, ids: changed }, { status: 500 });
      }
      changed.push(...((data ?? []) as { id: string }[]).map((r) => r.id));
    }

    return NextResponse.json({ updated: changed.length, ids: changed, capped: total > ids.length });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('POST /api/transactions/validate-matching error:', error);
    return NextResponse.json({ error: 'Failed to validate transactions' }, { status: 500 });
  }
}
