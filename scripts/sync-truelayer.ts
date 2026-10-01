/**
 * Local scheduled TrueLayer sync.
 *
 * Runs the same server-side sync used by the app, but from a plain Node process
 * so there is NO Vercel 60s function limit — full history + AI categorisation
 * can take as long as needed. Intended for Windows Task Scheduler (weekly +
 * 1st of month, via scripts/run-bank-sync.cmd).
 *
 * Since the daily Peter `finance-categorise` job (19:00) owns the bank sync,
 * this script SKIPS the sync step when a digest was built in the last 36h and
 * only runs the post-sync steps (rule mining, queue summary). Pass `--force`
 * to sync anyway. If the daily job stops, this falls back to syncing itself.
 *
 * Requires in .env.local: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_*,
 * TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET (needed to refresh the access
 * token — the stored one expires hourly, so scheduled runs always refresh).
 *
 * Run:  npm run sync:bank            (npm run sync:bank -- --force)
 */
import { loadEnvConfig } from '@next/env';

// Load .env.local exactly like Next does, BEFORE importing modules that read
// env at load time (supabaseAdmin). Hence the dynamic import below.
loadEnvConfig(process.cwd(), true);

const PROD_URL = 'https://finance-tracker-beryl-tau.vercel.app';
const DAILY_JOB_FRESH_HOURS = 36;

/**
 * TRUELAYER_CLIENT_SECRET is stored as a *sensitive* var in Vercel and cannot
 * be pulled locally. Without it a local token refresh always fails and wrongly
 * marks the connection expired (this killed every scheduled sync in July 2026).
 * When the secret is absent, delegate the sync to the production cron endpoint,
 * which holds the real secret, then continue with the local post-sync steps.
 */
async function runSync() {
  const { syncAllEnabledAccounts } = await import('@/lib/truelayer/sync');
  if (process.env.TRUELAYER_CLIENT_SECRET) return syncAllEnabledAccounts();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error('Neither TRUELAYER_CLIENT_SECRET nor CRON_SECRET set — cannot sync locally or via production');
  }
  console.log('  (no local TrueLayer secret — delegating sync to production cron endpoint)');
  const res = await fetch(`${PROD_URL}/api/truelayer/cron`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  if (!res.ok) throw new Error(`Production cron sync failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { results: Awaited<ReturnType<typeof syncAllEnabledAccounts>> };
  return body.results;
}

/** Newest daily-categorisation digest, if one was built recently. */
async function recentDailyDigest(): Promise<string | null> {
  const { supabaseAdmin } = await import('@/lib/supabase/server');
  const since = new Date(Date.now() - DAILY_JOB_FRESH_HOURS * 3_600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('categorisation_digests')
    .select('created_at')
    .neq('status', 'failed')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('  Could not check the daily digest job:', error.message);
    return null;
  }
  return data?.[0]?.created_at ?? null;
}

async function main() {
  const started = Date.now();
  const force = process.argv.includes('--force');

  console.log(`[${new Date().toISOString()}] TrueLayer scheduled sync starting…`);

  const dailyDigestAt = force ? null : await recentDailyDigest();
  let results: Awaited<ReturnType<typeof runSync>> = [];
  if (dailyDigestAt) {
    console.log(`  Bank sync skipped — the daily finance-categorise job owns it (last digest ${dailyDigestAt}). Use --force to sync anyway.`);
  } else {
    results = await runSync();
  }

  let imported = 0;
  let errors = 0;
  for (const r of results) {
    imported += r.imported;
    if (r.error) errors++;
    const bal = r.balance ? ` | bal £${r.balance.current}` : '';
    console.log(
      `  ${r.error ? '❌' : '✅'} ${r.accountName || r.accountId}: ` +
        `imported ${r.imported}, already ${r.alreadyPresent}${bal}${r.error ? ` — ${r.error}` : ''}`,
    );
  }

  // Mine merchant rules (and retire contradicted ones) from freshly settled
  // history, then re-run the review queue — cheap and idempotent.
  try {
    const { mineMerchantRules } = await import('@/lib/categorisation/rule-mining');
    const mined = await mineMerchantRules();
    console.log(
      `  Rule mining: ${mined.created} new rule(s), ${mined.superseded.length} superseded, ` +
        `${mined.skippedExisting} already covered` +
        (mined.conflicts.length ? `, ⚠ ${mined.conflicts.length} conflict(s)` : '') +
        (mined.recategorised ? ` | queue re-run cleared ${mined.recategorised.cleared}` : ''),
    );
  } catch (e) {
    console.warn('  Rule mining skipped:', e instanceof Error ? e.message : e);
  }

  // Review-queue summary so the scheduled-task log shows what needs a human.
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/server');
    const { count: flagged } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('needs_review', true);
    const { count: uncategorised } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .is('category_id', null);
    console.log(
      `  Review queue: ${flagged ?? 0} flagged for review, ${uncategorised ?? 0} uncategorised` +
        ((flagged ?? 0) > 0 ? ' → answer in #finance or run the finance-recategorise skill' : ''),
    );
  } catch (e) {
    console.warn('  Review summary skipped:', e instanceof Error ? e.message : e);
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[${new Date().toISOString()}] Done in ${secs}s — imported ${imported} across ` +
      `${results.length} account(s)${errors ? `, ${errors} error(s)` : ''}.`,
  );
  process.exit(errors && imported === 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Scheduled sync failed:', e);
  process.exit(1);
});
