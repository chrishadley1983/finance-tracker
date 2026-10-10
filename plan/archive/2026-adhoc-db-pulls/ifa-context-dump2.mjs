import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key, { db: { schema: 'finance' } });

const out = {};

// Latest snapshot per account
const { data: snaps, error: se } = await sb.from('wealth_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(80);
if (se) out.snap_error = se.message;
else {
  const latest = {};
  for (const s of snaps) {
    if (!latest[s.account_id]) latest[s.account_id] = s;
  }
  out.latest_snapshots = Object.values(latest);
}

// Budgets
const { data: budgets, error: be } = await sb.from('budgets').select('*, categories(name, group_name)');
out.budgets = be ? `ERR ${be.message}` : budgets?.map(b => ({ cat: b.categories?.name, monthly: b.monthly_amount ?? b.amount, ...(' ') && {} }));

// Income breakdown 2026 by category
const { data: txns } = await sb
  .from('transactions')
  .select('date, amount, description, categories(name, is_income, exclude_from_totals)')
  .gte('date', '2026-01-01')
  .order('date');
const inc = {};
for (const t of txns ?? []) {
  const cat = t.categories;
  if (cat?.exclude_from_totals) continue;
  const amt = Number(t.amount);
  if (cat?.is_income || amt > 0) {
    const cn = cat?.name ?? 'Uncategorised(+)';
    inc[cn] = (inc[cn] ?? 0) + amt;
  }
}
out.income_by_category_2026 = Object.entries(inc).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n}: £${Math.round(v)}`);

console.log(JSON.stringify(out, null, 2));
