// Simulate the new aggregator + history logic against live DB to confirm fixes
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } },
);

console.log('═══ FIX 1: April 2026 report spending ═══\n');

const startDate = '2026-04-01';
const endDate = '2026-05-01';

const { data: budgetData } = await supabase.rpc('get_budget_vs_actual', {
  p_year: 2026, p_month: 4,
});

const incomeCategoryIds = new Set(
  budgetData.filter((r) => r.is_income).map((r) => r.category_id),
);

const { data: excludedCats } = await supabase
  .from('categories')
  .select('id')
  .eq('exclude_from_totals', true);
const excludedIds = new Set(excludedCats.map((c) => c.id));

const allTx = [];
let from = 0;
while (true) {
  const { data: page } = await supabase
    .from('transactions')
    .select('amount, category_id')
    .gte('date', startDate)
    .lt('date', endDate)
    .range(from, from + 999);
  if (!page || page.length === 0) break;
  allTx.push(...page);
  if (page.length < 1000) break;
  from += 1000;
}

let income = 0, expenses = 0;
for (const t of allTx) {
  const amt = Number(t.amount);
  if (t.category_id && excludedIds.has(t.category_id)) continue;
  const isIncome = t.category_id ? incomeCategoryIds.has(t.category_id) : false;
  if (isIncome) {
    if (amt > 0) income += amt;
  } else {
    if (amt < 0) expenses += Math.abs(amt);
  }
}

console.log('  Old (RPC sum):      Income £9,730.10  Expenses £9,164.81');
console.log(`  New (sign-aware):   Income £${income.toFixed(2)}  Expenses £${expenses.toFixed(2)}`);
console.log(`  Savings rate:       ${income > 0 ? (((income - expenses) / income) * 100).toFixed(1) : '0'}%\n`);


console.log('═══ FIX 2: Wealth history transactional accounts ═══\n');

const TRANSACTIONAL_TYPES = new Set(['current', 'credit']);

const { data: accounts } = await supabase
  .from('accounts')
  .select('id, name, type, is_active')
  .eq('is_active', true);

const txAccounts = accounts.filter((a) => TRANSACTIONAL_TYPES.has(a.type));
const txAccountIds = txAccounts.map((a) => a.id);

const { data: txSnapshots } = await supabase
  .from('wealth_snapshots')
  .select('account_id, date, balance')
  .in('account_id', txAccountIds)
  .order('date', { ascending: true });

const snapshotsByAccount = new Map();
for (const s of txSnapshots) {
  const arr = snapshotsByAccount.get(s.account_id) || [];
  arr.push({ date: s.date, balance: Number(s.balance) });
  snapshotsByAccount.set(s.account_id, arr);
}

const txsByAccount = new Map();
let txFrom = 0;
while (true) {
  const { data: page } = await supabase
    .from('transactions')
    .select('account_id, date, amount')
    .in('account_id', txAccountIds)
    .range(txFrom, txFrom + 999);
  if (!page || page.length === 0) break;
  for (const t of page) {
    const arr = txsByAccount.get(t.account_id) || [];
    arr.push({ date: t.date, amount: Number(t.amount) });
    txsByAccount.set(t.account_id, arr);
  }
  if (page.length < 1000) break;
  txFrom += 1000;
}

// Compute end-of-month balance for Mar, Apr, May 2026 per account
const monthsToCheck = ['2026-02', '2026-03', '2026-04', '2026-05'];
console.log(`  ${'Account'.padEnd(30)} ${monthsToCheck.map(m => m.padEnd(15)).join('')}`);

for (const account of txAccounts) {
  const snaps = snapshotsByAccount.get(account.id) || [];
  if (snaps.length === 0) {
    console.log(`  ${account.name.padEnd(30)} (no snapshots)`);
    continue;
  }
  const txs = txsByAccount.get(account.id) || [];
  const balances = monthsToCheck.map((mk) => {
    const [yr, mo] = mk.split('-').map(Number);
    const lastDay = new Date(yr, mo, 0).getDate();
    const monthEndStr = `${yr}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    if (monthEndStr < snaps[0].date) return '—';
    let baseline = snaps[0];
    for (const s of snaps) {
      if (s.date <= monthEndStr) baseline = s; else break;
    }
    let bal = baseline.balance;
    for (const tx of txs) {
      if (tx.date > baseline.date && tx.date <= monthEndStr) bal += tx.amount;
    }
    return `£${bal.toFixed(2)}`;
  });
  console.log(`  ${account.name.padEnd(30)} ${balances.map(b => b.padEnd(15)).join('')}`);
}

console.log('\n  Production chart currently shows for May 1: current £15,618.61, credit £29.22');
console.log('  After fix, May entry will use the computed balances above.');
