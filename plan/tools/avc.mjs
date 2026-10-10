#!/usr/bin/env node
// @ts-check
/**
 * Abby's AVC% recipe for the current tax year, from the newest payslip
 * observation in plan/observations/payslips/ (or a file you name).
 * Replaces scripts/abby-avc-calculator.mjs (phase 2).
 *
 *   npm run plan:avc
 *   npm run plan:avc -- plan/observations/payslips/2026-09.json
 *
 * Add a payslip: copy the newest JSON, update taxMonth/payDate/basicMonthly/
 * taxablePayMonthly (at AVC 0%)/ytdTaxable/netMonthly/avcPct, then run
 * npm run plan:check (it re-derives payslip.basicAnnual from it).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAssumptionsFile } from '../inputs/assumptions.mjs';
import { avcRecipeFromYtd } from '../engine/pivot.mjs';

const planDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(planDir, 'observations', 'payslips');
const file = process.argv[2] ?? path.join(dir, fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().pop() ?? '');
const slip = JSON.parse(fs.readFileSync(file, 'utf8'));
const a = (await readAssumptionsFile()).values;
const r = avcRecipeFromYtd(a, slip);
const f = (/** @type {number} */ n) => '£' + Math.round(n).toLocaleString('en-GB');
console.log(`=== Abby AVC recipe — ${r.taxYear} from tax month ${String(r.taxMonth).padStart(2, '0')} (${path.basename(file)}) ===\n`);
console.log(`YTD taxable (actual):          ${f(slip.ytdTaxable)}`);
console.log(`+ ${r.remaining} months at current pay:    ${f(r.remaining * slip.taxablePayMonthly)}`);
console.log(`+ bonus ${slip.bonusSacrificed ? '(sacrificed, excluded)' : '(GUESS, in ANI)     '}    ${f(r.bonusInAni)}`);
console.log(`Projected ANI doing nothing:   ${f(r.aniDoNothing)}`);
console.log(`Extra sacrifice still needed:  ${f(r.extraNeeded)} over ${r.remaining} payslips (${f(r.perPayslip)}/mo exact, ${r.rawPct.toFixed(2)}%)`);
console.log(`\n>>> SET AVC TO ${r.avcPct}% <<<  (${f(r.actualPerPayslip)}/payslip)\n`);
console.log(`ANI lands at:                  ${f(r.landedAni)}  (buffer ${f(r.bufferBelowCliff)} below the cliff; target ${f(r.target)})`);
console.log(`Take-home cut:                 ~${f(r.netCutMonthly)}/mo  (${f(slip.netMonthly)} -> ~${f(r.netMonthlyAfter)})`);
console.log(`Post-sacrifice paid basic:     ${f(r.paidBasicAnnual)}/yr  (NMW floor ${f(r.nmwFloor)}: ${r.nmwOk ? 'OK' : 'BREACH — reduce AVC, sacrifice bonus instead'})`);
if (r.aboveCliff) console.log('\n!! ANI still above the cliff — AVC alone cannot get there; sacrifice bonus or add a lump-sum contribution.');
else if (r.aboveTarget) console.log('\n!! Above the operating target — full CB still kept but the buffer is thin.');
if (slip.avcPct && slip.avcPct !== r.avcPct) console.log(`\nNote: the payslip shows AVC ${slip.avcPct}%; the recipe now says ${r.avcPct}%.`);
