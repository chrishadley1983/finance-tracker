// Inspect the get_budget_vs_actual RPC definition
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } },
);

// Use direct SQL via a function or pg_proc query
const { data, error } = await supabase.rpc('get_budget_vs_actual', {
  p_year: 2026,
  p_month: 4,
});

if (error) {
  console.error('RPC error:', error);
  process.exit(1);
}

// Show the structure
console.log('Row count:', data.length);
console.log('First 3 rows:', JSON.stringify(data.slice(0, 3), null, 2));

// Sum by income/expense
let income = 0;
let expense = 0;
for (const r of data) {
  const amt = Number(r.actual_amount) || 0;
  if (r.is_income) income += amt;
  else expense += amt;
}
console.log('\nFrom RPC:');
console.log('Income:', income.toFixed(2));
console.log('Expense:', expense.toFixed(2));

// Now compute spending the dashboard way: debits-only
const startDate = '2026-04-01';
const endDate = '2026-05-01';

const allTx = [];
let from = 0;
const pageSize = 1000;
while (true) {
  const { data: page, error: txErr } = await supabase
    .from('transactions')
    .select('amount, category_id, date, description')
    .gte('date', startDate)
    .lt('date', endDate)
    .range(from, from + pageSize - 1);
  if (txErr) { console.error(txErr); break; }
  if (!page || page.length === 0) break;
  allTx.push(...page);
  if (page.length < pageSize) break;
  from += pageSize;
}

const { data: cats } = await supabase
  .from('categories')
  .select('id, is_income, exclude_from_totals, name');

const catMap = new Map(cats.map((c) => [c.id, c]));

let dashIncome = 0;
let dashExpense = 0;
let refundsInExpenseCats = 0;
let debitsInIncomeCats = 0;

for (const t of allTx) {
  if (!t.category_id) {
    // uncategorized
    if (Number(t.amount) < 0) dashExpense += Math.abs(Number(t.amount));
    continue;
  }
  const cat = catMap.get(t.category_id);
  if (!cat || cat.exclude_from_totals) continue;
  const amt = Number(t.amount);
  if (cat.is_income) {
    if (amt > 0) dashIncome += amt;
    else debitsInIncomeCats += Math.abs(amt);
  } else {
    if (amt < 0) dashExpense += Math.abs(amt);
    else refundsInExpenseCats += amt;
  }
}

console.log('\nDashboard-style (sign-aware):');
console.log('Income (credits in income cats):', dashIncome.toFixed(2));
console.log('Expense (debits in expense cats + uncategorized debits):', dashExpense.toFixed(2));
console.log('Refunds in expense cats (credits, not counted):', refundsInExpenseCats.toFixed(2));
console.log('Debits in income cats (not counted):', debitsInIncomeCats.toFixed(2));

console.log('\nDelta vs RPC: expense diff =', (expense - dashExpense).toFixed(2));
