/**
 * Reconcile April 2026 spending numbers:
 *   - MCP reported: £5,066
 *   - Dashboard shows: £3,459
 *
 * Compute every definition of "spending" the codebase uses and show what
 * falls in/out of each, so we can see exactly where the £1,607 gap lives.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } }
);

const START = '2026-04-01';
const END = '2026-04-30';

async function main() {
  // 1. Categories reference
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, is_income, exclude_from_totals');
  const catById = new Map((categories || []).map((c) => [c.id, c]));
  const excludedIds = new Set((categories || []).filter((c) => c.exclude_from_totals).map((c) => c.id));
  const incomeIds = new Set((categories || []).filter((c) => c.is_income).map((c) => c.id));

  console.log(`Categories flagged exclude_from_totals: ${excludedIds.size}`);
  for (const c of categories.filter((x) => x.exclude_from_totals)) console.log(`  - ${c.name}`);
  console.log(`\nCategories flagged is_income: ${incomeIds.size}`);
  for (const c of categories.filter((x) => x.is_income)) console.log(`  - ${c.name}`);

  // 2. All April txns (paginated to beat 1000-row limit — matches summary route)
  const txs = [];
  let from = 0;
  while (true) {
    const { data: batch } = await supabase
      .from('transactions')
      .select('id, date, amount, description, account_id, category_id')
      .gte('date', START).lte('date', END)
      .order('id').range(from, from + 999);
    if (!batch?.length) break;
    txs.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  console.log(`\nTotal April txns: ${txs.length}`);

  // 3. Per-account breakdown (sanity check)
  const { data: accounts } = await supabase.from('accounts').select('id, name, type');
  const accName = new Map((accounts || []).map((a) => [a.id, `${a.name} (${a.type})`]));
  const byAcc = new Map();
  for (const t of txs) {
    const k = t.account_id;
    const e = byAcc.get(k) || { count: 0, sum: 0, absSum: 0, negSum: 0, posSum: 0 };
    e.count++;
    e.sum += Number(t.amount);
    e.absSum += Math.abs(Number(t.amount));
    if (t.amount < 0) e.negSum += Number(t.amount);
    else e.posSum += Number(t.amount);
    byAcc.set(k, e);
  }
  console.log('\nPer-account April activity:');
  for (const [id, e] of byAcc) {
    console.log(`  ${accName.get(id) ?? id.slice(0, 8)}`);
    console.log(`    ${e.count} txns, net £${e.sum.toFixed(2)}  (debits £${e.negSum.toFixed(2)}, credits £${e.posSum.toFixed(2)})`);
  }

  // 4. Replicate both dashboard calcs
  const included = txs.filter((t) => !t.category_id || !excludedIds.has(t.category_id));

  // periodExpenses (SummaryCards): abs(all non-income non-excluded)
  const periodExpenses = included
    .filter((t) => !t.category_id || !incomeIds.has(t.category_id))
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  // by-category total: abs(debit-only non-excluded)  — note: does NOT filter income categories,
  // but debits in income categories would be rare (e.g. a refund)
  const byCategoryTotal = included
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  console.log('\n=== Dashboard reproductions ===');
  console.log(`SummaryCards periodExpenses  (abs of non-income, non-excluded)       : £${periodExpenses.toFixed(2)}`);
  console.log(`SpendingByCategory total     (abs of debits-only, non-excluded)       : £${byCategoryTotal.toFixed(2)}`);

  // 5. Show what the MCP number (£5,066) might have been
  //    If MCP queried "April 2026 spending" broadly, it likely did:
  //      - sum of abs(debits) across everything
  //      - or sum of abs(debits) across CA only
  //      - or sum of abs(all non-income) across everything
  const allDebitsAbs = txs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const caId = 'ec6dc8cc-e411-4a89-8bb3-d9084a2bf253';
  const ccId = '6dfac4bc-f55f-4b27-b012-4a1bed55d5e0';
  const caDebits = txs.filter((t) => t.account_id === caId && Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const ccDebits = txs.filter((t) => t.account_id === ccId && Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  console.log(`\nAll April debits abs, all accounts, no excl filter                   : £${allDebitsAbs.toFixed(2)}`);
  console.log(`  of which CA (HSBC Joint)                                            : £${caDebits.toFixed(2)}`);
  console.log(`  of which CC (HSBC Premier Card)                                     : £${ccDebits.toFixed(2)}`);

  // 6. What exactly IS in excluded categories? list them
  console.log('\n=== What got excluded from the dashboard totals? ===');
  const excluded = txs.filter((t) => t.category_id && excludedIds.has(t.category_id));
  console.log(`${excluded.length} txns, sum abs £${excluded.reduce((s,t)=>s+Math.abs(Number(t.amount)),0).toFixed(2)}`);
  const exclByCat = new Map();
  for (const t of excluded) {
    const key = catById.get(t.category_id)?.name ?? 'n/a';
    const e = exclByCat.get(key) || { count: 0, absSum: 0, items: [] };
    e.count++;
    e.absSum += Math.abs(Number(t.amount));
    if (e.items.length < 3) e.items.push(t);
    exclByCat.set(key, e);
  }
  for (const [name, e] of [...exclByCat.entries()].sort((a, b) => b[1].absSum - a[1].absSum)) {
    console.log(`  ${name}: ${e.count} txns, £${e.absSum.toFixed(2)}`);
    for (const it of e.items) console.log(`      ${it.date}  £${Number(it.amount).toFixed(2).padStart(10)}  ${it.description.slice(0, 60)}`);
  }

  // 7. What's in income categories (pulled out of periodExpenses but NOT out of by-category if debit)
  console.log('\n=== Txns in income categories (pulled out of SummaryCards only) ===');
  const incomeTx = included.filter((t) => t.category_id && incomeIds.has(t.category_id));
  console.log(`${incomeTx.length} txns, sum abs £${incomeTx.reduce((s,t)=>s+Math.abs(Number(t.amount)),0).toFixed(2)}`);
  const incByCat = new Map();
  for (const t of incomeTx) {
    const key = catById.get(t.category_id)?.name ?? 'n/a';
    const e = incByCat.get(key) || { count: 0, absSum: 0, negSum: 0 };
    e.count++;
    e.absSum += Math.abs(Number(t.amount));
    if (Number(t.amount) < 0) e.negSum += Math.abs(Number(t.amount));
    incByCat.set(key, e);
  }
  for (const [name, e] of [...incByCat.entries()].sort((a, b) => b[1].absSum - a[1].absSum)) {
    console.log(`  ${name}: ${e.count} txns, abs £${e.absSum.toFixed(2)}  (of which negative: £${e.negSum.toFixed(2)})`);
  }

  // 8. HSBC Premier payments — the user's hypothesis
  console.log('\n=== HSBC Premier CC payments in April (user flagged £1,610) ===');
  const hsbcPremier = txs.filter((t) => /HSBC PREMIER543458/i.test(t.description));
  let hsbcSum = 0;
  for (const t of hsbcPremier) {
    const cat = t.category_id ? catById.get(t.category_id) : null;
    const flags = [];
    if (cat?.exclude_from_totals) flags.push('EXCLUDED');
    if (cat?.is_income) flags.push('INCOME');
    console.log(`  ${t.date}  £${Number(t.amount).toFixed(2).padStart(10)}  [${accName.get(t.account_id)?.slice(0, 20)}]  cat=${cat?.name || 'uncategorised'}  ${flags.join(' ')}  ${t.description.slice(0, 40)}`);
    hsbcSum += Math.abs(Number(t.amount));
  }
  console.log(`  total abs: £${hsbcSum.toFixed(2)}`);
}

main().catch(console.error);
