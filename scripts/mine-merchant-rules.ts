/**
 * Mine merchant rules from categorised history.
 *
 * Any normalised merchant with ≥3 settled transactions and ≥90% category
 * agreement becomes a `contains` rule, so repeat merchants categorise
 * deterministically on future syncs.
 *
 * Run:  npm run mine:rules           (writes new rules)
 *       npm run mine:rules -- --dry-run   (report only)
 */
import { loadEnvConfig } from '@next/env';

// Load .env.local exactly like Next does, BEFORE importing modules that read
// env at load time (supabaseAdmin). Hence the dynamic import below.
loadEnvConfig(process.cwd(), true);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { mineMerchantRules } = await import('@/lib/categorisation/rule-mining');

  console.log(`[${new Date().toISOString()}] Rule mining starting${dryRun ? ' (dry run)' : ''}…`);
  const res = await mineMerchantRules({ dryRun });

  console.log(
    `  Scanned ${res.scanned} settled transactions → ${res.candidates.length} mineable merchants`,
  );
  console.log(
    `  ${dryRun ? 'Would create' : 'Created'} ${res.created} rule(s), ${res.skippedExisting} already covered`,
  );

  if (res.conflicts.length > 0) {
    console.log(`  ⚠ ${res.conflicts.length} conflict(s) with existing rules (NOT changed):`);
    for (const c of res.conflicts) {
      console.log(`    "${c.pattern}": existing ${c.existingCategoryId} vs history ${c.minedCategoryId}`);
    }
  }

  if (dryRun) {
    console.log('  Top candidates:');
    for (const c of res.candidates.slice(0, 25)) {
      console.log(
        `    ${c.pattern.padEnd(32)} n=${String(c.total).padStart(3)} agree=${Math.round(c.agreement * 100)}%`,
      );
    }
  }
}

main().catch((e) => {
  console.error('Rule mining failed:', e);
  process.exit(1);
});
