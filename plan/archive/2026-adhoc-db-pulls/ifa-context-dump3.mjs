import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key, { db: { schema: 'finance' } });

// Canonical classifyAmount (lib/reports/classify.ts)
function classify(amount, isIncome, excluded, isCategorised = true) {
  if (excluded) return { income: 0, expense: 0 };
  if (isIncome) return { income: amount > 0 ? amount : 0, expense: 0 };
  if (!isCategorised) return { income: 0, expense: amount < 0 ? Math.abs(amount) : 0 };
  return { income: 0, expense: -amount };
}

const { data: txns, error } = await sb
  .from('transactions')
  .select('date, amount, category_id, categories(name, is_income, exclude_from_totals)')
  .gte('date', '2026-01-01')
  .order('date');
if (error) { console.error(error); process.exit(1); }

const months = {};
const catSpend = {};
const incCat = {};
for (const t of txns) {
  const m = t.date.slice(0, 7);
  if (!months[m]) months[m] = { income: 0, expense: 0 };
  const cat = t.categories;
  const amt = Number(t.amount);
  const r = classify(amt, !!cat?.is_income, !!cat?.exclude_from_totals, !!t.category_id);
  months[m].income += r.income;
  months[m].expense += r.expense;
  if (r.expense !== 0) {
    const cn = cat?.name ?? 'Uncategorised';
    catSpend[cn] = (catSpend[cn] ?? 0) + r.expense;
  }
  if (r.income !== 0) {
    const cn = cat?.name ?? 'Uncategorised(+)';
    incCat[cn] = (incCat[cn] ?? 0) + r.income;
  }
}

console.log('=== 2026 monthly (canonical sign-aware) ===');
console.log('Month     Income    Expense   Net');
let ti = 0, te = 0;
for (const [m, v] of Object.entries(months).sort()) {
  console.log(`${m}   £${v.income.toFixed(0).padStart(7)}  £${v.expense.toFixed(0).padStart(7)}  £${(v.income - v.expense).toFixed(0).padStart(7)}`);
  ti += v.income; te += v.expense;
}
// Annualise on complete months Jan-May only
const complete = Object.entries(months).filter(([m]) => m < '2026-06');
const ci = complete.reduce((s, [, v]) => s + v.income, 0);
const ce = complete.reduce((s, [, v]) => s + v.expense, 0);
console.log(`\nJan-May totals: income £${ci.toFixed(0)}, expense £${ce.toFixed(0)}, net £${(ci - ce).toFixed(0)}`);
console.log(`Annualised (x12/5): income £${(ci * 12 / 5).toFixed(0)}, expense £${(ce * 12 / 5).toFixed(0)}`);

console.log('\n=== Net spend by category 2026 YTD ===');
for (const [n, v] of Object.entries(catSpend).sort((a, b) => b[1] - a[1])) {
  if (Math.abs(v) >= 50) console.log(`${n.padEnd(28)} £${v.toFixed(0)}`);
}
console.log('\n=== Income by category 2026 YTD ===');
for (const [n, v] of Object.entries(incCat).sort((a, b) => b[1] - a[1])) {
  console.log(`${n.padEnd(28)} £${v.toFixed(0)}`);
}
