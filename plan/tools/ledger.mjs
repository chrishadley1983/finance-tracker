#!/usr/bin/env node
// @ts-check
/**
 * The Plan E ledger from the current assumptions and the newest gilt-yield
 * observation. Replaces scripts/ifa-e-yearly.mjs (phase 2).
 *
 *   npm run plan:ledger                 # planning case (2% real)
 *   npm run plan:ledger -- 0            # flat 0% real
 *   npm run plan:ledger -- --json       # machine output
 *   npm run plan:ledger -- --spend 70000 --cash 0 --crypto 0   # scenario knobs (real £)
 *   npm run plan:ledger -- --yields plan/observations/gilt-yields/2026-09-20.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAssumptionsFile } from '../inputs/assumptions.mjs';
import { runLedger } from '../engine/ledger.mjs';

const planDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (/** @type {string} */ name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const built = await readAssumptionsFile();
const a = built.values;
const yieldsDir = path.join(planDir, 'observations', 'gilt-yields');
const yieldsPath = opt('yields') ?? path.join(yieldsDir, fs.readdirSync(yieldsDir).filter((f) => f.endsWith('.json')).sort().pop() ?? '');
const yields = JSON.parse(fs.readFileSync(yieldsPath, 'utf8'));
const G = args.find((x) => !x.startsWith('--') && !/\.json$/.test(x) && !isNaN(Number(x)) && args[args.indexOf(x) - 1]?.startsWith('--') !== true);
const out = runLedger(a, yields, {
  G: G !== undefined ? Number(G) : undefined,
  spend: opt('spend') !== undefined ? Number(opt('spend')) : undefined,
  hbPost: opt('hb') !== undefined ? Number(opt('hb')) : undefined,
  cash: opt('cash') !== undefined ? Number(opt('cash')) : undefined,
  crypto: opt('crypto') !== undefined ? Number(opt('crypto')) : undefined,
});
if (args.includes('--json')) { process.stdout.write(JSON.stringify(out) + '\n'); process.exit(0); }
const f = (/** @type {number|undefined} */ n) => (n === 0 || n === undefined ? '-' : Math.round(n));
console.log(`G=${out.G}  (assumptions prepared ${built.preparedOn}; yields ${yields.asOf})`);
for (const w of ['isa', 'sipp']) console.log(`${w.toUpperCase()} ladder: budget ${out.wrappers[w].budget.toFixed(1)}k → redemption ${out.wrappers[w].R.toFixed(1)}k per rung-year, portfolio real IRR ${(out.wrappers[w].irr * 100).toFixed(2)}%`);
console.log('AVC extra sacrifice £k by programme year: ' + out.avcSchedule.map((x) => x.toFixed(1)).join(', ') + ` (+ payroll ${out.payrollReal.toFixed(1)})`);
console.log('rung|epic|yield|price/£1|cost £k|redeems £k real');
for (const w of ['isa', 'sipp']) for (const r of out.wrappers[w].rungs) console.log([r.y, r.epic, (r.yld * 100).toFixed(2) + '%', r.price.toFixed(4), r.cost.toFixed(1), (out.wrappers[w].R * r.mult).toFixed(1)].join('|'));
console.log('coupons (real £k/yr): ' + Object.keys(out.wrappers.isa.flows).map((y) => `${y}:${(out.wrappers.isa.flows[Number(y)].coupon + (out.wrappers.sipp.flows[Number(y)]?.coupon ?? 0)).toFixed(1)}`).join(' '));
console.log('year|ISAladC|ISAladA|SIPPlad|SIPPeq|ACN|AbbyDC|AbbyISAeq|ISAeqNew|GIA|cash|crypto|TOTAL||rung+cpn|HB|SP|drawC|drawA|TFC|tax|surplus|taxedDraw');
for (const r of out.rows) console.log([r.year, f(r.isaLadC), f(r.isaLadA), f(r.sippLad), f(r.sippEq), f(r.acn), f(r.abbyDC), f(r.abbyIsaEq), f(r.isaEqNew), f(r.gia), f(r.cash), f(r.crypto), f(r.total), '', f(r.ladder), f(r.hb), f(r.sp), f(r.drawC), f(r.drawA), f(r.tfc), r.tax.toFixed(1), f(r.surplus), f(r.taxedDraw)].join('|'));
console.log(`lifetime tax ${out.lifeTax.toFixed(1)}   headline: ${JSON.stringify(out.headline)}`);
