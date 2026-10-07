/**
 * Look for AMAZON UK* NB3T26C £7.95 on 2026-03-31 in HSBC Joint Current.
 * Also list all £7.95 amount-out tx and all 31/03/2026 tx for context.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } }
);

const CA = 'ec6dc8cc-e411-4a89-8bb3-d9084a2bf253';

async function main() {
  console.log('--- 31/03/2026 transactions on Joint Current ---');
  const { data: mar31 } = await supabase
    .from('transactions')
    .select('id,date,amount,description,needs_review')
    .eq('account_id', CA)
    .eq('date', '2026-03-31');
  for (const r of mar31 || []) {
    console.log(`  ${r.amount.toString().padStart(10)}  ${r.description}`);
  }

  console.log('\n--- Searching for AMAZON UK* NB3T26C anywhere ---');
  const { data: nb3 } = await supabase
    .from('transactions')
    .select('id,date,amount,description,account_id')
    .ilike('description', '%NB3T26C%');
  for (const r of nb3 || []) {
    console.log(`  ${r.date}  ${r.amount}  ${r.description}  acct=${r.account_id}`);
  }

  console.log('\n--- All £-7.95 amounts on Joint Current ---');
  const { data: m795 } = await supabase
    .from('transactions')
    .select('date,amount,description')
    .eq('account_id', CA)
    .eq('amount', -7.95);
  for (const r of m795 || []) {
    console.log(`  ${r.date}  ${r.amount}  ${r.description}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
