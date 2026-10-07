/**
 * When were April txns CREATED in the DB? If many were added today (after the
 * dashboard was last viewed), that's our £1,607 gap.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } }
);

async function main() {
  const { data } = await supabase
    .from('transactions')
    .select('id, date, amount, description, category_id, created_at, category:categories(name, exclude_from_totals, is_income)')
    .gte('date', '2026-04-01').lte('date', '2026-04-30')
    .order('created_at', { ascending: false });

  // Bucket by created_at date
  const byCreated = new Map();
  for (const t of data) {
    const d = t.created_at?.slice(0, 10) ?? 'unknown';
    if (!byCreated.has(d)) byCreated.set(d, []);
    byCreated.get(d).push(t);
  }

  console.log('April 2026 txns bucketed by creation date:');
  for (const [d, txs] of [...byCreated.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const includedTxs = txs.filter((t) => {
      const c = t.category;
      if (c?.exclude_from_totals) return false;
      if (c?.is_income) return false;
      return true;
    });
    const absSum = includedTxs.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    console.log(`  created ${d}: ${txs.length} total, ${includedTxs.length} in periodExpenses, £${absSum.toFixed(2)} contribution`);
  }

  // Running total as-of each creation date
  console.log('\nCumulative periodExpenses by creation-date cutoff:');
  const sortedTxs = data.slice().sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  let running = 0;
  let lastDate = '';
  for (const t of sortedTxs) {
    const c = t.category;
    if (c?.exclude_from_totals) continue;
    if (c?.is_income) continue;
    running += Math.abs(Number(t.amount));
    const d = t.created_at?.slice(0, 10);
    if (d !== lastDate) {
      console.log(`  by end of ${d}: £${running.toFixed(2)}`);
      lastDate = d;
    }
  }
  console.log(`  FINAL: £${running.toFixed(2)}`);

  // Show what was created in the last 48h (likely after dashboard screenshot)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const recent = data.filter((t) => t.created_at > cutoff);
  const recentSum = recent.filter((t) => {
    const c = t.category;
    return !(c?.exclude_from_totals || c?.is_income);
  }).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  console.log(`\nApril txns created in last 48h (${recent.length}): £${recentSum.toFixed(2)} contribution to periodExpenses`);
}

main().catch(console.error);
