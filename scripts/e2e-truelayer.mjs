/* eslint-disable no-undef */
/**
 * End-to-end validation for the TrueLayer integration (deployed surface).
 * Non-mutating: only hits validation/guard paths, never triggers a real sync.
 *
 * Usage:  node scripts/e2e-truelayer.mjs [baseUrl]
 */
const BASE = process.argv[2] || process.env.BASE_URL || 'https://finance-tracker-beryl-tau.vercel.app';

const results = [];
const record = (label, pass, note = '') => {
  results.push({ label, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${label}${note ? ` — ${note}` : ''}`);
};
const code = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...opts });
  return res.status;
};

async function main() {
  console.log(`TrueLayer E2E — ${BASE}\n`);

  const statusRes = await fetch(`${BASE}/api/truelayer/status`);
  let status = null;
  try {
    status = await statusRes.json();
  } catch {
    /* ignore */
  }
  record('GET /api/truelayer/status = 200', statusRes.status === 200);
  record(
    'status.configured (needs TRUELAYER_CLIENT_SECRET)',
    status?.configured === true,
    status?.configured ? 'configured' : 'NOT configured — add the Live client secret',
  );
  record('accounts array present', Array.isArray(status?.accounts), `${status?.accounts?.length ?? 0} accounts`);

  record('GET /sync = 405 (POST only)', (await code('/api/truelayer/sync')) === 405);
  record(
    'POST /sync invalid = 400 or 503',
    [400, 503].includes(
      await code('/api/truelayer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"accountId":"not-a-uuid"}',
      }),
    ),
  );
  record(
    'POST /link invalid = 400',
    (await code('/api/truelayer/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"financeAccountId":"x"}',
    })) === 400,
  );
  record('GET /callback (no code) redirects', [302, 307].includes(await code('/api/truelayer/callback')));
  record('GET /settings/bank-sync auth-gated (307)', (await code('/settings/bank-sync')) === 307);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${failed.length === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failed.length} CHECK(S) FAILED`}`);
  // configured=false is expected until the user adds the Live secret — don't hard-fail on it alone.
  const hard = failed.filter((r) => !r.label.includes('configured'));
  process.exit(hard.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ E2E error:', e.message);
  process.exit(1);
});
