import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } }
);

async function compute(label, start, end) {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, is_income, exclude_from_totals');
  const excludedIds = new Set(categories.filter((c) => c.exclude_from_totals).map((c) => c.id));
  const incomeIds = new Set(categories.filter((c) => c.is_income).map((c) => c.id));

  const txs = [];
  let from = 0;
  while (true) {
    const { data: batch } = await supabase
      .from('transactions')
      .select('id, amount, category_id')
      .gte('date', start).lte('date', end)
      .order('id').range(from, from + 999);
    if (!batch?.length) break;
    txs.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }

  const included = txs.filter((t) => !t.category_id || !excludedIds.has(t.category_id));
  const periodExpenses = included
    .filter((t) => !t.category_id || !incomeIds.has(t.category_id))
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const byCatTotal = included
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  console.log(`${label}  (${start} .. ${end}):`);
  console.log(`  total txns              : ${txs.length}`);
  console.log(`  SummaryCards periodExpenses: £${periodExpenses.toFixed(2)}`);
  console.log(`  SpendingByCategory total   : £${byCatTotal.toFixed(2)}`);
}

await compute('MARCH 2026', '2026-03-01', '2026-03-31');
console.log('');
await compute('APRIL 2026', '2026-04-01', '2026-04-30');
