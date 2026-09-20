import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key, { db: { schema: 'finance' } });

const out = {};

// 1. Accounts with snapshot-anchored balances
const { data: balances, error: e1 } = await sb.rpc('get_account_balances_with_snapshots');
out.account_balances = balances ?? `ERR: ${e1?.message}`;

// 2. Accounts table raw
const { data: accounts } = await sb.from('accounts').select('*').order('name');
out.accounts = accounts?.map(a => ({ id: a.id, name: a.name, type: a.type ?? a.account_type, is_active: a.is_active, include_in_net_worth: a.include_in_net_worth }));

// 3. Latest wealth snapshots per account
const { data: snaps } = await sb.from('wealth_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(60);
out.recent_wealth_snapshots = snaps?.map(s => ({ date: s.snapshot_date, account_id: s.account_id, balance: s.balance, notes: s.notes }));

// 4. FIRE parameters (try both table names)
for (const t of ['fire_parameters', 'fire_inputs']) {
  const { data, error } = await sb.from(t).select('*');
  if (!error) out[t] = data;
}

// 5. 2026 monthly income/expense
const { data: txns } = await sb
  .from('transactions')
  .select('date, amount, categories(name, group_name, is_income, exclude_from_totals)')
  .gte('date', '2026-01-01')
  .order('date');
const months = {};
const catSpend = {};
for (const t of txns ?? []) {
  const m = t.date.slice(0, 7);
  if (!months[m]) months[m] = { income: 0, expense: 0 };
  const cat = t.categories;
  if (cat?.exclude_from_totals) continue;
  const amt = Number(t.amount);
  if (cat?.is_income || amt > 0) months[m].income += amt;
  else {
    months[m].expense += Math.abs(amt);
    const cn = cat?.name ?? 'Uncategorised';
    catSpend[cn] = (catSpend[cn] ?? 0) + Math.abs(amt);
  }
}
out.monthly_2026 = Object.fromEntries(Object.entries(months).sort().map(([m, v]) => [m, { income: Math.round(v.income), expense: Math.round(v.expense), net: Math.round(v.income - v.expense) }]));
out.top_expense_categories_2026 = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([n, v]) => `${n}: £${Math.round(v)}`);

// 6. Saved monthly reports
const { data: reports } = await sb.from('monthly_reports').select('year, month, report_data').order('year').order('month');
out.monthly_reports = reports?.map(r => ({ ym: `${r.year}-${String(r.month).padStart(2, '0')}`, ...r.report_data }));

console.log(JSON.stringify(out, null, 2));
