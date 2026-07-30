import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { computeRunRate, type SpendTxn } from '@/lib/plan/spend';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const sinceStr = since.toISOString().slice(0, 10);

    const all: SpendTxn[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('amount, category:categories(name, is_income, exclude_from_totals)')
        .gte('date', sinceStr)
        .range(from, from + 999);
      if (error) {
        return NextResponse.json({ runRate: null, warning: error.message }, { status: 200 });
      }
      for (const row of data ?? []) {
        all.push({ amount: Number(row.amount), category: row.category as SpendTxn['category'] });
      }
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({ runRate: computeRunRate(all), since: sinceStr, txnCount: all.length });
  } catch (error) {
    console.error('GET /api/plan/run-rate error:', error);
    return NextResponse.json({ runRate: null, warning: 'Internal error' }, { status: 200 });
  }
}
