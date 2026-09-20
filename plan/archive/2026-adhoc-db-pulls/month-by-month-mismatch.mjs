/**
 * For each month Jan-Apr 2026, compute:
 *   OLD periodExpenses (abs of all non-income non-excluded)
 *   NEW periodExpenses (abs of debits only, non-income non-excluded)
 *   Mismatch = OLD - NEW = sum of credits in non-income non-excluded categories.
 *
 * If mismatch > 0 in earlier months, the bug was hitting them too.
 * If mismatch == 0 except for April, the £1,500 holiday refund was the
 * only material trigger.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } }
);

async function main() {
  const { data: cats } = await supabase
    .from('categories').select('id, name, is_income, exclude_from_totals');
  const exc = new Set(cats.filter(c => c.exclude_from_totals).map(c => c.id));
  const inc = new Set(cats.filter(c => c.is_income).map(c => c.id));
  const catName = new Map(cats.map(c => [c.id, c.name]));

  const months = [
    ['2026-01', '2026-01-01', '2026-01-31'],
    ['2026-02', '2026-02-01', '2026-02-28'],
    ['2026-03', '2026-03-01', '2026-03-31'],
    ['2026-04', '2026-04-01', '2026-04-30'],
  ];

  console.log('Month   |    OLD   |    NEW   | Mismatch | Source rows');
  console.log('--------+----------+----------+----------+---------------------');

  for (const [label, start, end] of months) {
    const txs = [];
    let from = 0;
    while (true) {
      const { data: batch } = await supabase
        .from('transactions')
        .select('amount, category_id, description, date')
        .gte('date', start).lte('date', end)
        .order('id').range(from, from + 999);
      if (!batch?.length) break;
      txs.push(...batch);
      if (batch.length < 1000) break;
      from += 1000;
    }
    const incl = txs.filter(t => !t.category_id || !exc.has(t.category_id));
    const expense = incl.filter(t => !t.category_id || !inc.has(t.category_id));
    const oldSum = expense.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const newSum = expense.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const mismatch = oldSum - newSum;

    const offenders = expense.filter(t => Number(t.amount) > 0);
    const offSummary = offenders.length
      ? offenders.map(t => `£${Number(t.amount).toFixed(2)} ${catName.get(t.category_id) || 'uncat'}/${t.description.slice(0,20)}`).join('; ')
      : '—';
    console.log(`${label} | ${oldSum.toFixed(2).padStart(8)} | ${newSum.toFixed(2).padStart(8)} | ${mismatch.toFixed(2).padStart(8)} | ${offSummary}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
