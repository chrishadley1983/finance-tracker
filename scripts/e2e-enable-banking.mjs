/* eslint-disable no-undef */
/**
 * End-to-end validation workflow for the Enable Banking integration.
 *
 * Runs against the DEPLOYED app + the live Enable Banking API and asserts the
 * whole surface is wired correctly. Safe to run anytime — it performs no
 * mutations (no real sync is triggered; only validation/guard paths are hit).
 *
 * Stages:
 *   1. Config       — app id + private key are available.
 *   2. Live auth    — JWT authenticates against the Enable Banking API; reports
 *                     whether the production app is active yet.
 *   3. Deployed API — status/sync/link/callback guards + public legal pages +
 *                     auth-gated settings page behave correctly.
 *   4. Post-activation (only once HSBC is linked) — /aspsps lists HSBC.
 *
 * Usage:
 *   node scripts/e2e-enable-banking.mjs [baseUrl]
 *   BASE_URL=https://finance-tracker-beryl-tau.vercel.app node scripts/e2e-enable-banking.mjs
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SignJWT, importPKCS8 } from 'jose';

const API = 'https://api.enablebanking.com';
const BASE = process.argv[2] || process.env.BASE_URL || 'https://finance-tracker-beryl-tau.vercel.app';

const results = [];
const record = (label, pass, note = '') => {
  results.push({ label, pass, note });
  console.log(`  ${pass ? '✅' : '❌'} ${label}${note ? ` — ${note}` : ''}`);
};

function loadConfig() {
  let appId = process.env.ENABLE_BANKING_APP_ID;
  if (!appId) {
    try {
      appId = readFileSync('.env.local', 'utf8').match(/^ENABLE_BANKING_APP_ID=(.*)$/m)?.[1]?.trim();
    } catch {
      /* ignore */
    }
  }
  let key = process.env.ENABLE_BANKING_PRIVATE_KEY;
  if (key && key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if (!key || !key.includes('BEGIN')) {
    key = readFileSync(join(homedir(), '.enablebanking', 'private.pem'), 'utf8');
  }
  return { appId, key };
}

async function jwt({ appId, key }) {
  const k = await importPKCS8(key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ typ: 'JWT', alg: 'RS256', kid: appId })
    .setIssuer('enablebanking.com')
    .setAudience('api.enablebanking.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(k);
}

const code = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...opts });
  return res.status;
};

async function main() {
  console.log(`E2E validation — app: ${BASE}\n`);

  // Stage 1: config
  console.log('1. Config');
  const cfg = loadConfig();
  record('App id present', Boolean(cfg.appId), cfg.appId);
  record('Private key loaded', Boolean(cfg.key?.includes('BEGIN')));

  // Stage 2: live auth
  console.log('\n2. Live Enable Banking auth');
  const token = await jwt(cfg);
  record('JWT signed (RS256)', token.split('.').length === 3);
  const appRes = await fetch(`${API}/application`, { headers: { Authorization: `Bearer ${token}` } });
  record('GET /application authenticates', appRes.ok, `HTTP ${appRes.status}`);
  let appActive = false;
  if (appRes.ok) {
    const app = await appRes.json();
    appActive = Boolean(app.active);
    console.log(`     → ${app.name} · active=${app.active} · env=${app.environment}`);
  }

  // Stage 3: deployed API + pages
  console.log('\n3. Deployed surface');
  const statusRes = await fetch(`${BASE}/api/enable-banking/status`);
  let statusJson = null;
  try {
    statusJson = await statusRes.json();
  } catch {
    /* ignore */
  }
  record('GET /api/enable-banking/status = 200', statusRes.status === 200);
  record('status.configured = true', statusJson?.configured === true);
  const hsbc = (statusJson?.accounts ?? []).filter((a) => /hsbc/i.test(a.name));
  record('HSBC accounts visible', hsbc.length > 0, `${hsbc.length} found`);
  record('GET /sync = 405 (POST only)', (await code('/api/enable-banking/sync')) === 405);
  record(
    'POST /sync invalid = 400',
    (await code('/api/enable-banking/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"accountId":"not-a-uuid"}',
    })) === 400,
  );
  record(
    'POST /link invalid = 400',
    (await code('/api/enable-banking/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"financeAccountId":"x"}',
    })) === 400,
  );
  record('GET /callback (no code) redirects', [302, 307].includes(await code('/api/enable-banking/callback')));
  record('GET /privacy public (200)', (await code('/privacy')) === 200);
  record('GET /terms public (200)', (await code('/terms')) === 200);
  record('GET /settings/bank-sync auth-gated (307)', (await code('/settings/bank-sync')) === 307);

  // Stage 4: post-activation (only meaningful once HSBC is linked)
  console.log('\n4. Post-activation (after HSBC link)');
  if (appActive) {
    const aspspRes = await fetch(`${API}/aspsps?country=GB`, { headers: { Authorization: `Bearer ${token}` } });
    record('GET /aspsps?country=GB = 200', aspspRes.ok, `HTTP ${aspspRes.status}`);
    if (aspspRes.ok) {
      const { aspsps = [] } = await aspspRes.json();
      record('HSBC in GB ASPSP list', aspsps.some((a) => /hsbc/i.test(a.name)));
    }
  } else {
    console.log('     ⏭  App not active yet — link HSBC on the Bank Sync page to enable this stage.');
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${failed.length === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failed.length} CHECK(S) FAILED`}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ E2E validation error:', e.message);
  process.exit(1);
});
