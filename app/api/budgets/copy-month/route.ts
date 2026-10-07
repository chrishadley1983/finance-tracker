import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const monthString = z.string().regex(MONTH, 'Use YYYY-MM');

const copyMonthSchema = z.object({
  from: monthString,
  to: monthString,
  /** Required (true) to overwrite a target month that already has non-zero budgets. */
  overwrite: z.boolean().optional(),
});

const parseMonth = (s: string) => {
  const [y, m] = s.split('-').map(Number);
  return { year: y, month: m };
};

/**
 * POST /api/budgets/copy-month { from: 'YYYY-MM', to: 'YYYY-MM', overwrite?: boolean }
 *
 * Copies the non-zero budgets of one month onto another (upsert per category).
 * Categories with no budget in `from` are left as they are in `to`.
 *
 * If `to` already has non-zero budgets and `overwrite` is not true, nothing is
 * written and a 409 says how many would be replaced, so the page can confirm.
 *
 * → { success, copied, replaced, previous: [{ categoryId, amount }] }
 *   `previous` holds the target's amounts before the copy (0 where absent), for Undo.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, to, overwrite } = copyMonthSchema.parse(body);
    if (from === to) {
      return NextResponse.json({ error: 'Pick two different months to copy between.' }, { status: 400 });
    }
    const src = parseMonth(from);
    const dst = parseMonth(to);

    const { data: sourceRows, error: srcErr } = await supabaseAdmin
      .from('budgets')
      .select('category_id, amount')
      .eq('year', src.year)
      .eq('month', src.month)
      .gt('amount', 0);
    if (srcErr) {
      console.error('copy-month: reading source failed:', srcErr);
      return NextResponse.json({ error: srcErr.message }, { status: 500 });
    }
    if (!sourceRows || sourceRows.length === 0) {
      return NextResponse.json({ error: `There are no budgets in ${from} to copy.` }, { status: 404 });
    }

    const { data: targetRows, error: dstErr } = await supabaseAdmin
      .from('budgets')
      .select('category_id, amount')
      .eq('year', dst.year)
      .eq('month', dst.month);
    if (dstErr) {
      console.error('copy-month: reading target failed:', dstErr);
      return NextResponse.json({ error: dstErr.message }, { status: 500 });
    }

    const before = new Map((targetRows ?? []).map((r) => [r.category_id, Number(r.amount)]));
    const existing = (targetRows ?? []).filter((r) => Number(r.amount) > 0).length;
    if (existing > 0 && overwrite !== true) {
      return NextResponse.json(
        { error: `${to} already has ${existing} budget${existing === 1 ? '' : 's'} set.`, existing },
        { status: 409 }
      );
    }

    const rows = sourceRows.map((r) => ({
      category_id: r.category_id,
      year: dst.year,
      month: dst.month,
      amount: Number(r.amount),
    }));
    const { error: upsertErr } = await supabaseAdmin.from('budgets').upsert(rows, { onConflict: 'category_id,year,month' });
    if (upsertErr) {
      console.error('copy-month: upsert failed:', upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    const previous = rows.map((r) => ({ categoryId: r.category_id, amount: before.get(r.category_id) ?? 0 }));
    const replaced = previous.filter((p) => p.amount > 0).length;
    return NextResponse.json({ success: true, copied: rows.length, replaced, previous });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('POST /api/budgets/copy-month error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
