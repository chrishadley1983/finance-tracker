/**
 * Mine merchant rules from categorised history.
 *
 * Re-points/deletes rules Chris's manual decisions contradict, deletes
 * digit-token rules, then turns any normalised merchant with ≥3 settled
 * transactions and ≥90% category agreement into a `contains` rule, and
 * finally re-runs the review queue against the updated rules.
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

  if (res.superseded.length > 0) {
    console.log(`  ${dryRun ? 'Would supersede' : 'Superseded'} ${res.superseded.length} rule(s) contradicted by Chris's manual history:`);
    for (const s of res.superseded) {
      console.log(
        `    "${s.pattern}": ${s.action === 'repoint' ? `re-point ${s.oldCategoryId} → ${s.newCategoryId}` : `delete (was ${s.oldCategoryId})`}` +
          ` — ${s.evidence.disagree}/${s.evidence.total} manual rows disagree`,
      );
    }
  }
  if (res.digitRulesDeleted.length > 0) {
    console.log(`  ${dryRun ? 'Would delete' : 'Deleted'} ${res.digitRulesDeleted.length} digit-token rule(s): ${res.digitRulesDeleted.join(', ')}`);
  }
  if (res.lowQualityDeleted.length > 0) {
    console.log(
      `  ${dryRun ? 'Would delete' : 'Deleted'} ${res.lowQualityDeleted.length} mined rule(s) history no longer supports: ` +
        res.lowQualityDeleted.map((l) => `${l.pattern} (${Math.round(l.agreement * 100)}% of ${l.matched})`).join(', '),
    );
  }
  if (res.rejectedBroad.length > 0) {
    console.log(
      `  Rejected ${res.rejectedBroad.length} too-broad candidate(s): ` +
        res.rejectedBroad.map((c) => `${c.pattern} (${Math.round(c.broadAgreement * 100)}% of ${c.matched})`).join(', '),
    );
  }
  if (res.recategorised) {
    const r = res.recategorised;
    console.log(`  Review queue re-run: examined ${r.examined}, changed ${r.changed}, cleared ${r.cleared}`);
  }

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
