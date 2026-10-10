import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } }
);

async function main() {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, is_income, exclude_from_totals');
  const catById = new Map(categories.map((c) => [c.id, c]));
  const excludedIds = new Set(categories.filter((c) => c.exclude_from_totals).map((c) => c.id));

  // April — match dashboard's `get_spending_by_category`: debits only, excluding excluded cats
  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, description, category_id')
    .gte('date', '2026-04-01').lte('date', '2026-04-30')
    .lt('amount', 0);

  const byCat = new Map();
  let total = 0;
  for (const t of txs) {
    if (t.category_id && excludedIds.has(t.category_id)) continue;
    const c = catById.get(t.category_id);
    const key = c?.name || 'Uncategorized';
    const e = byCat.get(key) || { sum: 0, count: 0, income: c?.is_income };
    e.sum += Math.abs(Number(t.amount));
    e.count++;
    byCat.set(key, e);
    total += Math.abs(Number(t.amount));
  }

  console.log(`April 2026 SpendingByCategory (debits, non-excluded)    TOTAL £${total.toFixed(2)}`);
  console.log('---');
  for (const [name, e] of [...byCat.entries()].sort((a, b) => b[1].sum - a[1].sum)) {
    const flag = e.income ? ' [is_income]' : '';
    console.log(`  ${name.padEnd(30)}  £${e.sum.toFixed(2).padStart(10)}  (${e.count} txns)${flag}`);
  }

  // Same, but also excluding is_income cats (what SummaryCards does — minus the credits too, here we only have debits anyway)
  console.log('\nSame, but also excluding is_income categories:');
  let totalSansIncome = 0;
  for (const [name, e] of byCat) {
    if (e.income) continue;
    totalSansIncome += e.sum;
  }
  console.log(`  total: £${totalSansIncome.toFixed(2)}`);

  // 22-day hypothesis — what if user saw £3,459 when dashboard was showing only April 1-21?
  for (const end of ['2026-04-10', '2026-04-15', '2026-04-20', '2026-04-21', '2026-04-22']) {
    const { data: upTo } = await supabase
      .from('transactions')
      .select('amount, category_id')
      .gte('date', '2026-04-01').lte('date', end)
      .lt('amount', 0);
    const sum = upTo.filter((t) => !t.category_id || !excludedIds.has(t.category_id))
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    console.log(`\n  If range were 2026-04-01 .. ${end}: £${sum.toFixed(2)}`);
  }
}

main().catch(console.error);
