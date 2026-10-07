#!/usr/bin/env node
/* global process, console, URL, document */
/**
 * UI harness: render a real app page (with the real shell and production CSS)
 * in Chromium against fixture API data, and save screenshots. No login or
 * database needed. Dev tool only; not part of the app build.
 *
 *   npx next build                               # once, to produce the CSS
 *   node scripts/ui-harness/render.mjs --page app/budgets/page.tsx --path /budgets \
 *        --fixtures scripts/ui-harness/fixtures/budgets.json --out /tmp/shots/budgets
 *
 * Fixtures: { "/api/budgets/comparison": {...json...}, "/api/foo": {...} }.
 * Keys match by pathname (exact, then longest prefix). A key containing "?"
 * matches path plus query exactly and wins over a path-only key. Unmatched /api calls
 * return {} and are listed in the report so you can add fixtures for them.
 * Shots: desktop light + dark (1320x860), phone light + dark (390x844, full page).
 * Prints console errors, horizontal overflow and unmatched API calls.
 * Requires NODE_PATH to include Playwright (e.g. /opt/node22/lib/node_modules).
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const root = process.cwd();
const page = args.page;
const urlPath = args.path || '/';
const out = args.out || '/tmp/ui-harness';
const fixtures = args.fixtures ? JSON.parse(fs.readFileSync(args.fixtures, 'utf8')) : {};
if (!page) {
  console.error('--page is required');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const cssDir = path.join(root, '.next/static/css');
if (!fs.existsSync(cssDir)) {
  console.error('No .next/static/css: run `npx next build` first.');
  process.exit(1);
}
const css = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');

const here = path.dirname(new URL(import.meta.url).pathname);
const entry = path.join(out, 'entry.tsx');
fs.writeFileSync(
  entry,
  `import { createRoot } from 'react-dom/client';\nimport Page from ${JSON.stringify(path.resolve(root, page))};\ncreateRoot(document.getElementById('root')!).render(<Page />);\n`
);
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: path.join(out, 'bundle.js'),
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    'next/navigation': path.join(here, 'stubs/navigation.ts'),
    'next/link': path.join(here, 'stubs/link.tsx'),
    '@/lib/supabase/client': path.join(here, 'stubs/supabase-client.ts'),
  },
  tsconfig: path.join(root, 'tsconfig.json'),
  nodePaths: [path.join(root, 'node_modules')],
  logLevel: 'warning',
});
const bundle = fs.readFileSync(path.join(out, 'bundle.js'));
if (/SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin/.test(bundle.toString())) {
  console.log('WARNING: bundle references server-only Supabase code');
}

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const defaults = {
  '/api/nav-summary': {
    asOf: '2026-10-07',
    review: { total: 3, uncategorised: 2, withSuggestion: 2 },
    transactions: { thisMonth: 48 },
    budget: { spent: 2148, planned: 3400, usedPct: 63 },
    subscriptions: { monthly: 486.4, next: { name: 'Netflix', date: '2026-10-12', amount: 12.99 } },
    sync: { lastSyncAt: new Date(Date.now() - 3 * 3600e3).toISOString(), accounts: ['HSBC Joint Current Account'] },
  },
  '/api/nav-pins': { pins: [] },
};
const all = { ...defaults, ...fixtures };
const keys = Object.keys(all).sort((a, b) => b.length - a.length);
const html = (theme) => `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>:root{--font-ui:'Public Sans';--font-fig:'IBM Plex Mono'}</style><style>${css}</style></head>
<body class="bg-ground text-ink"><div id="root"></div><script>window.__path=${JSON.stringify(urlPath)}</script><script src="/bundle.js"></script></body></html>`;

// Prefer the pre-installed Chromium when the repo's Playwright expects a different build.
const preinstalled = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
});
const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});
const report = [];
const shots = [
  ['desktop-light', 1320, 860, 'light', false],
  ['desktop-dark', 1320, 860, 'dark', false],
  ['phone-light', 390, 844, 'light', true],
  ['phone-dark', 390, 844, 'dark', true],
];
for (const [name, w, h, theme, full] of shots) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'en-GB', timezoneId: 'Europe/London' });
  const p = await ctx.newPage();
  const errors = [];
  const unmatched = new Set();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.route('http://ui.test/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/bundle.js') return r.fulfill({ body: bundle, contentType: 'text/javascript' });
    if (u.pathname.startsWith('/api/')) {
      const withQuery = u.pathname + u.search;
      const key =
        keys.find((k) => k.includes('?') && withQuery === k) ??
        keys.find((k) => u.pathname === k) ??
        keys.find((k) => !k.includes('?') && u.pathname.startsWith(k));
      if (!key) unmatched.add(`${r.request().method()} ${u.pathname}`);
      return r.fulfill({ json: key ? all[key] : {} });
    }
    return r.fulfill({ body: html(theme), contentType: 'text/html' });
  });
  await p.goto('http://ui.test/');
  await p.waitForTimeout(1200);
  const file = path.join(out, `${name}.png`);
  await p.screenshot({ path: file, fullPage: full });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  report.push({ shot: file, errors: errors.slice(0, 5), overflow, unmatched: [...unmatched] });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
