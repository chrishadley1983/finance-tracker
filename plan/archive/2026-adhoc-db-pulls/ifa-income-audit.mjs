import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key, { db: { schema: 'finance' } });

// Every transaction in 2026 that the canonical rule counts as income:
// category is_income=true AND amount > 0, not excluded
const { data: txns, error } = await sb
  .from('transactions')
  .select('date, amount, description, account_id, accounts(name), categories(name, is_income, exclude_from_totals)')
  .gte('date', '2026-01-01')
  .lt('date', '2026-06-01')
  .order('date');
if (error) { console.error(error); process.exit(1); }

let total = 0;
const byCat = {};
console.log('Date        Amount      Account                       Category            Description');
for (const t of txns) {
  const cat = t.categories;
  if (!cat?.is_income || cat?.exclude_from_totals) continue;
  const amt = Number(t.amount);
  if (amt <= 0) continue;
  total += amt;
  byCat[cat.name] = (byCat[cat.name] ?? 0) + amt;
  console.log(
    `${t.date}  £${amt.toFixed(2).padStart(9)}  ${(t.accounts?.name ?? '?').padEnd(28)}  ${cat.name.padEnd(18)}  ${t.description}`
  );
}
console.log(`\nTOTAL Jan-May income: £${total.toFixed(2)}`);
for (const [n, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`  ${n}: £${v.toFixed(2)}`);

// Also: any POSITIVE amounts in non-income, non-excluded categories (these net against expenses, not income)
let refunds = 0;
for (const t of txns) {
  const cat = t.categories;
  if (cat?.is_income || cat?.exclude_from_totals) continue;
  const amt = Number(t.amount);
  if (amt > 0) refunds += amt;
}
console.log(`\n(For reference: £${refunds.toFixed(2)} of positive amounts in expense categories — netted against spend, NOT income)`);
