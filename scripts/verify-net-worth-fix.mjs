import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } },
);

const TRANSACTIONAL_TYPES = new Set(['current', 'credit']);

async function netWorthForMonth(year, month) {
  const monthStr = String(month).padStart(2, '0');
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStartStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEndStr = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, type, name, include_in_net_worth')
    .eq('include_in_net_worth', true);

  const accountTypeMap = new Map(accounts.map(a => [a.id, a.type]));
  const snapshotIds = accounts.filter(a => !TRANSACTIONAL_TYPES.has(a.type)).map(a => a.id);
  const txIds = accounts.filter(a => TRANSACTIONAL_TYPES.has(a.type)).map(a => a.id);

  const balanceByAccount = new Map();

  // Snapshot accounts
  const { data: snaps } = await supabase
    .from('wealth_snapshots')
    .select('balance, account_id, date')
    .in('account_id', snapshotIds)
    .lte('date', nextMonthStartStr)
    .order('date', { ascending: false });
  for (const s of snaps || []) {
    if (!balanceByAccount.has(s.account_id)) {
      balanceByAccount.set(s.account_id, Number(s.balance));
    }
  }

  // Transactional
  const { data: txSnaps } = await supabase
    .from('wealth_snapshots')
    .select('balance, account_id, date')
    .in('account_id', txIds)
    .lte('date', monthEndStr)
    .order('date', { ascending: false });
  const baseline = new Map();
  for (const s of txSnaps || []) {
    if (!baseline.has(s.account_id)) {
      baseline.set(s.account_id, { date: s.date, balance: Number(s.balance) });
    }
  }

  const txByAccount = new Map();
  let txFrom = 0;
  while (true) {
    const { data: page } = await supabase
      .from('transactions')
      .select('account_id, date, amount')
      .in('account_id', txIds)
      .lte('date', monthEndStr)
      .range(txFrom, txFrom + 999);
    if (!page || page.length === 0) break;
    for (const t of page) {
      const arr = txByAccount.get(t.account_id) || [];
      arr.push({ date: t.date, amount: Number(t.amount) });
      txByAccount.set(t.account_id, arr);
    }
    if (page.length < 1000) break;
    txFrom += 1000;
  }

  for (const id of txIds) {
    const b = baseline.get(id);
    if (!b) continue;
    let bal = b.balance;
    for (const tx of txByAccount.get(id) || []) {
      if (tx.date > b.date) bal += tx.amount;
    }
    balanceByAccount.set(id, bal);
  }

  const typeMap = new Map();
  let total = 0;
  for (const [id, bal] of balanceByAccount) {
    const t = accountTypeMap.get(id);
    total += bal;
    typeMap.set(t, (typeMap.get(t) || 0) + bal);
  }

  return { total, byType: Object.fromEntries(typeMap) };
}

const months = [
  ['Jan', 2026, 1], ['Feb', 2026, 2], ['Mar', 2026, 3], ['Apr', 2026, 4],
];

console.log('Month  New Net Worth   By Type');
for (const [label, y, m] of months) {
  const r = await netWorthForMonth(y, m);
  const types = Object.entries(r.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([t, v]) => `${t}=£${Math.round(v).toLocaleString()}`)
    .join(', ');
  console.log(`${label}    £${Math.round(r.total).toLocaleString().padStart(11)}   ${types}`);
}
