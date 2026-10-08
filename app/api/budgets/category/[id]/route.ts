import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PAGE_ROWS } from '@/lib/transactions/query';
import { buildCategoryDetail, detailWindow, periodBounds } from '@/lib/budgets/category-detail';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const querySchema = z.object({
  id: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

/**
 * GET /api/budgets/category/[id]?year=2026[&month=10]
 * One budget line in detail: period budget and actual, 12 months of actual vs
 * budget for the chart, the trend, the last 3 transactions and the period's
 * transaction count. Month view when `month` is given, otherwise the year.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const sp = request.nextUrl.searchParams;
    const q = querySchema.parse({ id: (await params).id, year: sp.get('year'), month: sp.get('month') || undefined });
    const view = q.month ? 'month' : 'year';
    const month = q.month ?? null;

    const { data: cat, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id, name, group_name, is_income')
      .eq('id', q.id)
      .maybeSingle();
    if (catError) return NextResponse.json({ error: catError.message }, { status: 500 });
    if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const win = detailWindow(view, q.year, month);
    const bounds = periodBounds(view, q.year, month);

    // Budgets for the 24-month window (two calendar years at most).
    const { data: budgets, error: bError } = await supabaseAdmin
      .from('budgets')
      .select('year, month, amount')
      .eq('category_id', q.id)
      .gte('year', win.start.year)
      .lte('year', win.anchor.year);
    if (bError) return NextResponse.json({ error: bError.message }, { status: 500 });

    // Transactions in the window, paged past PostgREST's row cap.
    const transactions: { date: string; amount: number }[] = [];
    for (let from = 0; ; from += PAGE_ROWS) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('date, amount')
        .eq('category_id', q.id)
        .gte('date', win.from)
        .lte('date', win.to)
        .order('date', { ascending: true })
        .range(from, from + PAGE_ROWS - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      transactions.push(...((data ?? []) as { date: string; amount: number }[]));
      if (!data || data.length < PAGE_ROWS) break;
    }

    // The last 3 transactions up to the end of the period, and the period count.
    const [recentRes, countRes] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('id, date, description, amount, account:accounts(name)')
        .eq('category_id', q.id)
        .lte('date', bounds.to)
        .order('date', { ascending: false })
        .limit(3),
      supabaseAdmin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', q.id)
        .gte('date', bounds.from)
        .lte('date', bounds.to),
    ]);
    if (recentRes.error) return NextResponse.json({ error: recentRes.error.message }, { status: 500 });
    if (countRes.error) return NextResponse.json({ error: countRes.error.message }, { status: 500 });

    type RecentRow = { id: string; date: string; description: string; amount: number; account: { name: string } | { name: string }[] | null };
    const recent = ((recentRes.data ?? []) as RecentRow[]).map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      amount: Number(r.amount),
      account: Array.isArray(r.account) ? r.account[0]?.name ?? null : r.account?.name ?? null,
    }));

    const detail = buildCategoryDetail({
      category: { id: cat.id, name: cat.name, groupName: cat.group_name ?? '', isIncome: Boolean(cat.is_income) },
      view,
      year: q.year,
      month,
      now: new Date(),
      budgets: (budgets ?? []) as { year: number; month: number; amount: number }[],
      transactions,
      recent,
      count: countRes.count ?? 0,
    });

    return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('GET /api/budgets/category/[id] error:', error);
    return NextResponse.json({ error: 'Failed to load this budget line' }, { status: 500 });
  }
}
