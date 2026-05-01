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
  .select('id, name, type, is_active')
  .eq('is_active', true);

const accMap = new Map(accounts.map((a) => [a.id, a]));

const investmentAccounts = accounts.filter((a) => a.type === 'investment');
console.log(`Accounts with type='investment' (used by history API for valuations table):`);
for (const a of investmentAccounts) {
  console.log(`  ${a.name}`);
}

console.log(`\nLatest investment_valuations for those accounts:`);
for (const a of investmentAccounts) {
  const { data: vals } = await supabase
    .from('investment_valuations')
    .select('date, value')
    .eq('account_id', a.id)
    .order('date', { ascending: false })
    .limit(3);
  if (!vals || vals.length === 0) {
    console.log(`  ${a.name}: NO VALUATIONS`);
    continue;
  }
  for (const v of vals) {
    console.log(`  ${a.name.padEnd(30)} ${v.date}  £${Number(v.value).toLocaleString('en-GB')}`);
  }
}

// Now what is the History API returning for May 2026?
// The "investment" type total in May should be sum of investment_valuations dated 2026-05-*
console.log(`\nMay 2026 totals as the History API computes them:`);
const { data: mayVals } = await supabase
  .from('investment_valuations')
  .select('account_id, date, value')
  .gte('date', '2026-05-01')
  .lt('date', '2026-06-01');
console.log('investment_valuations in May 2026:', mayVals?.length || 0, 'rows');
for (const v of mayVals || []) {
  console.log(`  ${accMap.get(v.account_id)?.name?.padEnd(30) || v.account_id} ${v.date} £${Number(v.value).toLocaleString('en-GB')}`);
}

const { data: maySnaps } = await supabase
  .from('wealth_snapshots')
  .select('account_id, date, balance')
  .gte('date', '2026-05-01')
  .lt('date', '2026-06-01');
console.log(`\nwealth_snapshots in May 2026:`, maySnaps?.length || 0, 'rows');
for (const s of maySnaps || []) {
  const a = accMap.get(s.account_id);
  console.log(`  ${a?.name?.padEnd(30) || s.account_id}  type=${a?.type?.padEnd(10) || '?'}  ${s.date}  £${Number(s.balance).toLocaleString('en-GB')}`);
}
