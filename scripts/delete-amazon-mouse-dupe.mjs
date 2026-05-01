/**
 * One-off: delete the unannotated duplicate of the Amazon mouse purchase.
 *
 * Context: HSBC live shows £10,663.61 on 30/04/2026; FT shows £10,655.66.
 * The £7.95 drift is caused by two rows on 2026-03-31 for the same
 * AMAZON UK* NB3T26C purchase — one canonical CSV row and one annotated
 * "...VIS - Mouse" row. User wants to keep the annotated one.
 *
 * Run with --write to actually delete; default is dry-run.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DRY_RUN = !process.argv.includes('--write');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'finance' } }
);

const CA = 'ec6dc8cc-e411-4a89-8bb3-d9084a2bf253';

async function main() {
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('id,date,amount,description,categorisation_source,needs_review,created_at')
    .eq('account_id', CA)
    .eq('date', '2026-03-31')
    .eq('amount', -7.95);
  if (error) throw error;

  console.log(`Found ${rows.length} candidate rows on 2026-03-31 with amount -£7.95:`);
  for (const r of rows) {
    console.log(`  id=${r.id}`);
    console.log(`    description: ${r.description}`);
    console.log(`    source: ${r.categorisation_source}  needs_review: ${r.needs_review}  created: ${r.created_at}`);
  }

  if (rows.length !== 2) {
    console.log('\nABORT: expected exactly 2 rows. Got ' + rows.length + '. No deletion.');
    return;
  }

  const annotated = rows.find(r => /\s+-\s+mouse\b/i.test(r.description));
  const plain = rows.find(r => r !== annotated);
  if (!annotated || !plain) {
    console.log('\nABORT: could not identify annotated vs plain. No deletion.');
    return;
  }

  console.log(`\nKeep:   ${annotated.id}  "${annotated.description}"`);
  console.log(`Delete: ${plain.id}  "${plain.description}"`);

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] No changes made. Re-run with --write to delete.');
    return;
  }

  // Remove any hash audit row first to avoid orphaned audit refs.
  const { error: hashErr } = await supabase
    .from('imported_transaction_hashes')
    .delete()
    .eq('transaction_id', plain.id);
  if (hashErr) {
    console.log(`Hash audit cleanup warning: ${hashErr.message}`);
  }

  const { error: delErr } = await supabase
    .from('transactions')
    .delete()
    .eq('id', plain.id);
  if (delErr) throw delErr;

  console.log('\nDeleted.');
}

main().catch(e => { console.error(e); process.exit(1); });
