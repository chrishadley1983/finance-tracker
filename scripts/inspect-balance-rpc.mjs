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
  .select('id, name, type')
  .eq('is_active', true)
  .in('type', ['current', 'credit']);

const { data, error } = await supabase.rpc('get_account_balances_with_snapshots', {
  account_ids: accounts.map(a => a.id),
});

if (error) {
  console.error(error);
  process.exit(1);
}

const accMap = new Map(accounts.map(a => [a.id, a]));
console.log('RPC returns:');
for (const r of data) {
  const a = accMap.get(r.account_id);
  console.log(`  ${a.name.padEnd(30)} type=${a.type.padEnd(8)} snapshot=${r.snapshot_date} (£${r.snapshot_balance})  tx_sum=£${r.transactions_sum}  current=£${r.current_balance}`);
}
