/**
 * Find recurring monthly manual income transactions.
 * "Manual" = categorisation_source = 'manual' OR account is not auto-imported (no recent imports).
 * Look at the last 6 months to spot a pattern.
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
    .from('categories').select('id, name, is_income');
  const incomeIds = new Set(cats.filter(c => c.is_income).map(c => c.id));
  const catName = new Map(cats.map(c => [c.id, c.name]));

  const { data: accounts } = await supabase.from('accounts').select('id, name, type');
  const accName = new Map(accounts.map(a => [a.id, a.name]));

  // Pull income txns from Oct 2025 - Apr 2026
  const txs = [];
  let from = 0;
  while (true) {
    const { data: batch } = await supabase
      .from('transactions')
      .select('id, date, amount, description, account_id, category_id, categorisation_source')
      .gte('date', '2025-10-01').lte('date', '2026-04-30')
      .gt('amount', 0)
      .order('date', { ascending: true })
      .range(from, from + 999);
    if (!batch?.length) break;
    txs.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }

  // Filter to income-categorised credits only
  const incomeTxs = txs.filter(t => t.category_id && incomeIds.has(t.category_id));

  // Group by month
  const byMonth = new Map();
  for (const t of incomeTxs) {
    const m = t.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(t);
  }

  console.log('Income transactions per month (Oct 2025 - Apr 2026):\n');
  for (const m of [...byMonth.keys()].sort()) {
    const rows = byMonth.get(m);
    const sum = rows.reduce((s, r) => s + Number(r.amount), 0);
    console.log(`=== ${m}  (${rows.length} txns, total £${sum.toFixed(2)}) ===`);
    for (const r of rows.sort((a,b) => a.date.localeCompare(b.date))) {
      const cat = catName.get(r.category_id);
      const acc = accName.get(r.account_id);
      const src = r.categorisation_source || '?';
      console.log(`  ${r.date}  £${Number(r.amount).toFixed(2).padStart(10)}  [${acc}]  cat=${cat}  src=${src}  ${r.description.slice(0, 50)}`);
    }
    console.log('');
  }

  // Identify "manual" accounts (those without recent imports — proxy: account name has "Manual" or no recent import session)
  // Simpler: look at categorisation_source = 'manual' specifically
  console.log('=== Income txns where categorisation_source = manual ===');
  const manualCats = incomeTxs.filter(t => t.categorisation_source === 'manual');
  console.log(`${manualCats.length} txns`);

  // And accounts that aren't auto-imported
  console.log('\n=== Account types of income txns ===');
  const byAcct = new Map();
  for (const t of incomeTxs) {
    const a = accName.get(t.account_id) || t.account_id;
    byAcct.set(a, (byAcct.get(a) || 0) + 1);
  }
  for (const [a, c] of [...byAcct.entries()].sort((x,y) => y[1] - x[1])) {
    console.log(`  ${a}: ${c} txns`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
