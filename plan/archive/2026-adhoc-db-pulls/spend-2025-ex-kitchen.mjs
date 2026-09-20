import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key, { db: { schema: 'finance' } });

// Paged fetch to bypass 1000-row limit
async function fetchAll(start, end) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('transactions')
      .select('date, amount, description, category_id, categories(name, group_name, is_income, exclude_from_totals)')
      .gte('date', start).lt('date', end)
      .order('date').range(from, from + PAGE - 1);
    if (error) { console.error(error); process.exit(1); }
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

const txns = await fetchAll('2024-05-01', '2026-05-01'); // 24 months
console.log(`Fetched ${txns.length} transactions May 2024 – Apr 2026`);

// Kitchen = Home improvement category + Extension category + obvious kitchen-vendors
const KITCHEN_CATS = new Set(['Home improvement', 'Extension']);
const months = {};

for (const t of txns) {
  const cat = t.categories;
  if (cat?.exclude_from_totals) continue;
  const m = t.date.slice(0,7);
  if (!months[m]) months[m] = { income: 0, expense: 0, kitchen: 0 };
  const amt = Number(t.amount);
  const isIncome = cat?.is_income || amt > 0;
  if (isIncome) {
    months[m].income += amt;
  } else {
    const abs = Math.abs(amt);
    months[m].expense += abs;
    if (cat && KITCHEN_CATS.has(cat.name)) {
      months[m].kitchen += abs;
    }
  }
}

console.log('\nMonth       Income      Expense     Kitchen     Ex-Kitchen   Net(ex-kitch)');
let summable = []; // months with reliable data (income > £3k)
for (const [m, v] of Object.entries(months).sort()) {
  const ex = v.expense - v.kitchen;
  const reliable = v.income > 3000;
  console.log(`${m}    £${v.income.toFixed(0).padStart(8)}   £${v.expense.toFixed(0).padStart(8)}   £${v.kitchen.toFixed(0).padStart(8)}   £${ex.toFixed(0).padStart(8)}   £${(v.income - ex).toFixed(0).padStart(8)}  ${reliable ? '' : '(partial)'}`);
  if (reliable) summable.push({ m, ...v, ex });
}

console.log(`\nReliable months (income > £3k): ${summable.length}`);
const ttlInc = summable.reduce((s,x) => s + x.income, 0);
const ttlExp = summable.reduce((s,x) => s + x.expense, 0);
const ttlKit = summable.reduce((s,x) => s + x.kitchen, 0);
const ttlEx  = summable.reduce((s,x) => s + x.ex, 0);
const n = summable.length;
console.log(`  Avg income:           £${(ttlInc/n).toFixed(0)}/mo  → £${(ttlInc/n*12).toFixed(0)}/yr`);
console.log(`  Avg expense (gross):  £${(ttlExp/n).toFixed(0)}/mo  → £${(ttlExp/n*12).toFixed(0)}/yr`);
console.log(`  Avg expense (ex-kit): £${(ttlEx/n).toFixed(0)}/mo   → £${(ttlEx/n*12).toFixed(0)}/yr`);
console.log(`  Avg kitchen spend:    £${(ttlKit/n).toFixed(0)}/mo  (total ${ttlKit.toFixed(0)})`);
console.log(`  Avg net (ex-kitchen): £${((ttlInc - ttlEx)/n).toFixed(0)}/mo  → £${((ttlInc - ttlEx)/n*12).toFixed(0)}/yr`);

// Show 2025 vs 2026 split
console.log('\n2025 reliable months:');
const r2025 = summable.filter(x => x.m.startsWith('2025'));
if (r2025.length) {
  const i = r2025.reduce((s,x) => s + x.income, 0) / r2025.length;
  const e = r2025.reduce((s,x) => s + x.ex, 0) / r2025.length;
  console.log(`  ${r2025.length} months. Avg income £${i.toFixed(0)}/mo, ex-kitchen spend £${e.toFixed(0)}/mo, net £${(i-e).toFixed(0)}/mo`);
}
const r2026 = summable.filter(x => x.m.startsWith('2026'));
if (r2026.length) {
  const i = r2026.reduce((s,x) => s + x.income, 0) / r2026.length;
  const e = r2026.reduce((s,x) => s + x.ex, 0) / r2026.length;
  console.log(`2026: ${r2026.length} months. Avg income £${i.toFixed(0)}/mo, ex-kitchen spend £${e.toFixed(0)}/mo, net £${(i-e).toFixed(0)}/mo`);
}
