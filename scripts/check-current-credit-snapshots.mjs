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
  .eq('is_active', true)
  .in('type', ['current', 'credit']);

console.log('Current + credit accounts:');
for (const a of accounts) console.log(`  ${a.type.padEnd(8)} ${a.name}`);

console.log('\nAll wealth_snapshots for current/credit accounts:');
for (const a of accounts) {
  const { data: snaps } = await supabase
    .from('wealth_snapshots')
    .select('date, balance')
    .eq('account_id', a.id)
    .order('date', { ascending: false });
  if (!snaps || snaps.length === 0) {
    console.log(`  ${a.name}: none`);
    continue;
  }
  console.log(`  ${a.name} (${snaps.length} snapshots):`);
  for (const s of snaps) {
    console.log(`    ${s.date}  £${Number(s.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
  }
}
