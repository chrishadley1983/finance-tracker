/**
 * Find April txns that were likely recategorised recently (updated_at
 * much later than created_at, or created during April but in a
 * non-excluded category that sums to about £1,617).
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
  // 1. Global Money and Abba entries in April — the user's hypothesis
  const { data: candidates } = await supabase
    .from('transactions')
    .select(`id, date, amount, description, category_id, created_at, updated_at,
             category:categories(id, name, is_income, exclude_from_totals)`)
    .gte('date', '2026-04-01').lte('date', '2026-04-30')
    .or('description.ilike.%global money%,description.ilike.%abba%');

  console.log('=== Global Money + Abba Voyage April txns ===');
  let sum = 0;
  for (const t of candidates || []) {
    const cat = t.category;
    const flags = [];
    if (cat?.exclude_from_totals) flags.push('EXCLUDED');
    if (cat?.is_income) flags.push('INCOME');
    console.log(`  ${t.date}  £${Number(t.amount).toFixed(2).padStart(10)}  cat=${cat?.name || '—'} ${flags.join(' ')}`);
    console.log(`    desc: ${t.description.slice(0, 70)}`);
    console.log(`    created ${t.created_at?.slice(0,19)}  updated ${t.updated_at?.slice(0,19)}`);
    sum += Math.abs(Number(t.amount));
  }
  console.log(`  total abs: £${sum.toFixed(2)}`);

  // 2. Broader: any April txn whose updated_at > created_at + 1 day (i.e. later edit)
  const { data: all } = await supabase
    .from('transactions')
    .select(`id, date, amount, description, category:categories(name, exclude_from_totals)`)
    .gte('date', '2026-04-01').lte('date', '2026-04-30')
    .not('updated_at', 'is', null);

  const recats = (all || []).filter((t) => {
    // Heuristic: created_at and updated_at both exist. We filter client-side using a second query.
    return true;
  });

  // Actually we need both fields - re-query
  const { data: all2 } = await supabase
    .from('transactions')
    .select('id, date, amount, description, category_id, created_at, updated_at, category:categories(name, exclude_from_totals)')
    .gte('date', '2026-04-01').lte('date', '2026-04-30');

  const recentlyEdited = (all2 || []).filter((t) => {
    const c = new Date(t.created_at).getTime();
    const u = new Date(t.updated_at).getTime();
    return u - c > 24 * 60 * 60 * 1000; // edited at least a day after creation
  });

  console.log(`\n=== April txns edited >24h after creation: ${recentlyEdited.length} ===`);
  for (const t of recentlyEdited.slice(0, 40)) {
    const cat = t.category;
    console.log(`  ${t.date}  £${Number(t.amount).toFixed(2).padStart(10)}  cat=${cat?.name || '—'}  updated ${t.updated_at?.slice(0,10)}  ${t.description.slice(0, 55)}`);
  }

  // 3. Scenario check: what if Global Money + Abba were EXCLUDED? What would the total be?
  const gmAbbaAbs = (candidates || []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  console.log(`\nIf Global Money + Abba (£${gmAbbaAbs.toFixed(2)}) were excluded, total drops from £5,065.90 to £${(5065.9 - gmAbbaAbs).toFixed(2)}`);
}

main().catch(console.error);
