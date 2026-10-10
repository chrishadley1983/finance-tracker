import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const sb = createClient(url, key, { db: { schema: 'finance' } });

// Get all transactions Jan-Apr 2026 with categories joined
const { data: txns, error } = await sb
  .from('transactions')
  .select('date, amount, category_id, categories(name, group_name, is_income, exclude_from_totals)')
  .gte('date', '2026-01-01')
  .lt('date', '2026-05-01')
  .order('date');

if (error) { console.error(error); process.exit(1); }

const months = {};
for (const t of txns) {
  const key = t.date.slice(0, 7);
  if (!months[key]) months[key] = { income: 0, expense: 0, count: 0, excluded: 0 };
  const cat = t.categories;
  if (cat?.exclude_from_totals) { months[key].excluded += Number(t.amount); continue; }
  months[key].count++;
  if (cat?.is_income || Number(t.amount) > 0) {
    months[key].income += Number(t.amount);
  } else {
    months[key].expense += Math.abs(Number(t.amount));
  }
}

console.log('Month       Income      Expense     Net         #txns');
for (const [m, v] of Object.entries(months).sort()) {
  console.log(`${m}    £${v.income.toFixed(0).padStart(8)}   £${v.expense.toFixed(0).padStart(8)}   £${(v.income - v.expense).toFixed(0).padStart(8)}   ${v.count}`);
}

// Average
const ms = Object.values(months);
const avgIncome = ms.reduce((s, m) => s + m.income, 0) / ms.length;
const avgExpense = ms.reduce((s, m) => s + m.expense, 0) / ms.length;
console.log('---');
console.log(`Avg/mo:     £${avgIncome.toFixed(0).padStart(8)}   £${avgExpense.toFixed(0).padStart(8)}`);
console.log(`Annualised: £${(avgIncome*12).toFixed(0).padStart(8)}   £${(avgExpense*12).toFixed(0).padStart(8)}`);

// Saved monthly_reports if any
const { data: reports } = await sb.from('monthly_reports').select('year, month, report_data, generated_at').order('year').order('month');
if (reports?.length) {
  console.log('\nSaved monthly_reports:');
  for (const r of reports) {
    const d = r.report_data;
    console.log(`  ${r.year}-${String(r.month).padStart(2,'0')}: income=£${d.income} expenses=£${d.expenses} sr=${d.savings_rate}% nw=£${d.net_worth}`);
  }
}
