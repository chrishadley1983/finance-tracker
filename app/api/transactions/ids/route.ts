import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { BULK_MAX_IDS } from '@/lib/validations/transactions';
import { applyTransactionFilters, parseTransactionQuery, PAGE_ROWS } from '@/lib/transactions/query';

export const dynamic = 'force-dynamic';

interface IdRow {
  id: string;
  amount: number;
  description: string;
  needs_review: boolean | null;
  category_id: string | null;
}

/**
 * GET /api/transactions/ids?<same filters as GET /api/transactions>
 *
 * Every matching transaction id (newest first), capped at BULK_MAX_IDS, for
 * "Select all N matching". Each id also comes with the few fields the bulk
 * bar needs (amount for the selected total, description for merchant
 * grouping, needs_review for the flag toggle, category_id for "Make a rule").
 *
 * → { ids: string[], rows: IdRow[], total: number, capped: boolean }
 */
export async function GET(request: NextRequest) {
  try {
    const query = parseTransactionQuery(request.nextUrl.searchParams);

    const page = (from: number) =>
      applyTransactionFilters(
        supabaseAdmin
          .from('transactions')
          .select('id, amount, description, needs_review, category_id', { count: 'exact' }),
        query
      )
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, Math.min(from + PAGE_ROWS, BULK_MAX_IDS) - 1);

    const first = await page(0);
    if (first.error) {
      return NextResponse.json({ error: first.error.message }, { status: 500 });
    }

    const rows: IdRow[] = [...((first.data ?? []) as IdRow[])];
    const total = first.count ?? rows.length;
    const wanted = Math.min(total, BULK_MAX_IDS);

    // PostgREST caps each response at PAGE_ROWS; fetch the rest in parallel.
    const offsets: number[] = [];
    for (let from = PAGE_ROWS; from < wanted; from += PAGE_ROWS) offsets.push(from);
    const rest = await Promise.all(offsets.map(page));
    for (const r of rest) {
      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
      rows.push(...((r.data ?? []) as IdRow[]));
    }

    const capped = rows.slice(0, BULK_MAX_IDS).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      description: r.description,
      needs_review: Boolean(r.needs_review),
      category_id: r.category_id ?? null,
    }));

    return NextResponse.json({
      ids: capped.map((r) => r.id),
      rows: capped,
      total,
      capped: total > BULK_MAX_IDS,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('GET /api/transactions/ids error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
