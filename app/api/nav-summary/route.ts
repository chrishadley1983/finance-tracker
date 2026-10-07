import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ukToday } from '@/lib/subscriptions/analysis';
import { budgetUsage, monthBounds, subscriptionsSummary, type NavSummary } from '@/lib/nav-summary';

export const dynamic = 'force-dynamic';

const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
  const { count: n, error } = await q;
  if (error) throw new Error(error.message);
  return n ?? 0;
};

/** GET /api/nav-summary — the live figures shown in the navigation. */
export async function GET() {
  try {
    const today = ukToday();
    const { start, end, year, month } = monthBounds(today);
    const tx = () => supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true });

    const [total, uncategorised, withSuggestion, thisMonth, savings, subs, synced] = await Promise.all([
      count(tx().or('category_id.is.null,needs_review.eq.true')),
      count(tx().is('category_id', null)),
      count(tx().eq('needs_review', true).not('category_id', 'is', null)),
      count(tx().gte('date', start).lte('date', end)),
      supabaseAdmin.rpc('get_savings_rate', { p_year: year, p_month: month }),
      supabaseAdmin.from('subscriptions').select('name, amount, frequency, status, next_renewal_date'),
      supabaseAdmin
        .from('accounts')
        .select('name, last_sync_at')
        .eq('sync_enabled', true)
        .order('last_sync_at', { ascending: false, nullsFirst: false }),
    ]);
    if (savings.error) throw new Error(savings.error.message);
    if (subs.error) throw new Error(subs.error.message);
    if (synced.error) throw new Error(synced.error.message);

    const row = (savings.data as Array<Record<string, unknown>> | null)?.[0] ?? {};
    const body: NavSummary = {
      asOf: today,
      review: { total, uncategorised, withSuggestion },
      transactions: { thisMonth },
      budget: budgetUsage(Number(row.total_expense_actual) || 0, Number(row.total_expense_budget) || 0),
      subscriptions: subscriptionsSummary(subs.data ?? [], today),
      sync: {
        lastSyncAt: synced.data?.[0]?.last_sync_at ?? null,
        accounts: (synced.data ?? []).map((a) => a.name),
      },
    };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (error) {
    console.error('GET /api/nav-summary error:', error);
    return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 });
  }
}
