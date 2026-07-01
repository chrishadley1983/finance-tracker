/**
 * Local scheduled TrueLayer sync.
 *
 * Runs the same server-side sync used by the app, but from a plain Node process
 * so there is NO Vercel 60s function limit — full history + AI categorisation
 * can take as long as needed. Intended for Windows Task Scheduler (weekly +
 * 1st of month).
 *
 * Requires in .env.local: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_*,
 * TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET (needed to refresh the access
 * token — the stored one expires hourly, so scheduled runs always refresh).
 *
 * Run:  npm run sync:bank
 */
import { loadEnvConfig } from '@next/env';

// Load .env.local exactly like Next does, BEFORE importing modules that read
// env at load time (supabaseAdmin). Hence the dynamic import below.
loadEnvConfig(process.cwd(), true);

async function main() {
  const started = Date.now();
  const { syncAllEnabledAccounts } = await import('@/lib/truelayer/sync');

  console.log(`[${new Date().toISOString()}] TrueLayer scheduled sync starting…`);
  const results = await syncAllEnabledAccounts();

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
