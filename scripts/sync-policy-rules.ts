/**
 * Upsert Chris's standing policies (lib/categorisation/policies.ts) into
 * finance.category_mappings as is_system policy rules, then re-categorise the
 * review queue against them.
 *
 * Run:  npm run policies:sync              (writes)
 *       npm run policies:sync -- --dry-run (report only)
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd(), true);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { syncPolicies } = await import('@/lib/categorisation/policy-sync');
  const res = await syncPolicies({ dryRun });
  const verb = dryRun ? 'would be' : 'were';
  console.log(`Policies: ${res.inserted.length} ${verb} inserted, ${res.updated.length} ${verb} updated, ${res.unchanged.length} unchanged`);
  if (res.inserted.length) console.log(`  inserted: ${res.inserted.join(', ')}`);
  if (res.updated.length) console.log(`  updated:  ${res.updated.join(', ')}`);
  if (res.overridden.length) {
    console.log(`  ⚠ overridden by Chris's "always" answers (left as-is — update policies.ts): ${res.overridden.join(', ')}`);
  }

  if (!dryRun) {
    const { recategorisePending } = await import('@/lib/categorisation/recategorise');
    const r = await recategorisePending();
    console.log(`Review queue re-run: examined ${r.examined}, changed ${r.changed}, cleared ${r.cleared}`);
  }
}

main().catch((e) => {
  console.error('Policy sync failed:', e);
  process.exit(1);
});
