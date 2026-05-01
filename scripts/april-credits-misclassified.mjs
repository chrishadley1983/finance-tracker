/**
 * Find April credits sitting in non-income, non-excluded categories.
 * These are double-counted by SummaryCards periodExpenses but correctly
 * excluded by SpendingByCategory (which filters amount<0).
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
  const catById = new Map((cats || []).map(c => [c.id, c]));
  const excludedIds = new Set((cats || []).filter(c => c.exclude_from_totals).map(c => c.id));
  const incomeIds = new Set((cats || []).filter(c => c.is_income).map(c => c.id));

  // Paginate
  const txs = [];
  let from = 0;
  while (true) {
    const { data: batch } = await supabase
      .from('transactions')
      .select('id, date, amount, description, account_id, category_id')
      .gte('date', '2026-04-01').lte('date', '2026-04-30')
      .order('id').range(from, from + 999);
    if (!batch?.length) break;
    txs.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }

  // Credits that are NOT income and NOT excluded
  const offenders = txs.filter(t =>
    Number(t.amount) > 0 &&
    (!t.category_id || (!incomeIds.has(t.category_id) && !excludedIds.has(t.category_id)))
  );

  console.log(`Credits in non-income, non-excluded categories: ${offenders.length} txns`);
  let sum = 0;
  for (const t of offenders) {
    const c = t.category_id ? catById.get(t.category_id) : null;
    sum += Number(t.amount);
    console.log(`  ${t.date}  £${Number(t.amount).toFixed(2).padStart(10)}  cat=${c?.name || 'UNCATEGORISED'}  ${t.description.slice(0, 50)}`);
  }
  console.log(`Total: £${sum.toFixed(2)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
