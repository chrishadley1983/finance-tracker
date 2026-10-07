import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } },
);

const { data: accounts } = await supabase
  .from('accounts')
  .select('id, name, type, include_in_net_worth')
  .order('type');

const accMap = new Map(accounts.map((a) => [a.id, a]));

const investmentTypes = new Set(['investment', 'isa', 'pension']);
const investmentAccounts = accounts.filter((a) =>
  investmentTypes.has(a.type) && a.include_in_net_worth
);

console.log('Investment accounts:');
for (const a of investmentAccounts) {
  console.log(`  ${a.type.padEnd(12)} ${a.name}`);
}

// Latest snapshot per account up to and including 2026-05-01
const cutoff = '2026-05-01';

console.log(`\nLatest snapshot per investment account (date <= ${cutoff}):`);

for (const a of investmentAccounts) {
  const { data: snaps } = await supabase
    .from('wealth_snapshots')
    .select('date, balance')
    .eq('account_id', a.id)
    .lte('date', cutoff)
    .order('date', { ascending: false })
    .limit(2);
  if (!snaps || snaps.length === 0) {
    console.log(`  ${a.name}: NO SNAPSHOTS`);
    continue;
  }
  const latest = snaps[0];
  const prev = snaps[1];
  const ageDays = Math.floor((new Date(cutoff) - new Date(latest.date)) / 86400000);
  const flag = ageDays > 31 ? ' ⚠ STALE' : '';
  console.log(
    `  ${a.name.padEnd(40)} ${latest.date}  £${Number(latest.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}  (${ageDays}d old)${flag}` +
    (prev ? `   prev ${prev.date} £${Number(prev.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '')
  );
}

// What does the wealth API return for the "current" net worth?
console.log('\nMost recent snapshot date overall:');
const { data: latestOverall } = await supabase
  .from('wealth_snapshots')
  .select('date')
  .order('date', { ascending: false })
  .limit(1);
console.log('  ', latestOverall[0]?.date);

console.log('\nAll snapshots dated 2026-05-01:');
const { data: may1 } = await supabase
  .from('wealth_snapshots')
  .select('account_id, balance, date')
  .eq('date', '2026-05-01');
for (const s of may1 || []) {
  const a = accMap.get(s.account_id);
  console.log(`  ${a?.name?.padEnd(40) || s.account_id}  £${Number(s.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
}
