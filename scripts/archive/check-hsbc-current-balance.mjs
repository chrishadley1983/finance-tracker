/**
 * Compare current FT balance for HSBC Joint Current to HSBC live.
 * HSBC live (01/05/2026 09:35): £10,663.61 (after HSBC PREMIER543458 -1826.00 on 30/04/2026)
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
const CA_OPENING = 28702.74;
const HSBC_LIVE = 10663.61;

async function main() {
  // 1. Sum all transactions (paginate around 1000-row default cap)
  const allTx = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id,date,amount,description,needs_review')
      .eq('account_id', CA)
      .order('date', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    allTx.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const totalSum = allTx.reduce((s, r) => s + Number(r.amount), 0);
  const computed = CA_OPENING + totalSum;
  const drift = computed - HSBC_LIVE;

  console.log(`Total tx        : ${allTx.length}`);
  console.log(`Opening         : £${CA_OPENING.toFixed(2)}`);
  console.log(`Sum(tx)         : £${totalSum.toFixed(2)}`);
  console.log(`Computed (FT)   : £${computed.toFixed(2)}`);
  console.log(`HSBC live       : £${HSBC_LIVE.toFixed(2)}`);
  console.log(`Drift           : £${drift.toFixed(2)}`);
  console.log('');

  // 2. Show transactions on/after 27 Apr 2026
  console.log('Transactions on/after 27 Apr 2026:');
  const recent = allTx.filter(r => r.date >= '2026-04-27');
  for (const r of recent) {
    const amt = Number(r.amount).toFixed(2).padStart(10);
    console.log(`  ${r.date}  ${amt}  ${r.description}${r.needs_review ? '  [REVIEW]' : ''}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
