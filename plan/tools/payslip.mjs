#!/usr/bin/env node
// @ts-check
/**
 * Record a payslip observation from the PDF, then show what it implies.
 *
 *   npm run plan:payslip -- add --month 2026-09 --tax-month 6 --pay-date 2026-09-28 \
 *       --basic 6153.15 --taxable 6528.76 --ytd-taxable 40150.20 --net 2548.75 --avc 55 \
 *       [--bonus 3691.89] [--bonus-sacrificed] [--other-income 0] [--extra-avc-taken 3384.23] [--note "..."] [--force]
 *   npm run plan:payslip -- list
 *
 * "taxable" is the month's taxable pay AT AVC 0% (basic × 0.955 + car + medical) — the recipe
 * projects the remaining months from it; "extra-avc-taken" is the £ of AVC sacrificed so far
 * this tax year (it reduces the do-nothing ANI). After adding, the tool compares the basic with
 * plan/assumptions.json and prints the plan:set command if they differ, then the AVC recipe.
 */
import { readAssumptionsFile } from '../inputs/assumptions.mjs';
import { listPayslips, writePayslip } from '../inputs/payslips.mjs';
import { avcRecipeFromYtd } from '../engine/pivot.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (/** @type {string} */ name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const num = (/** @type {string} */ name) => { const v = opt(name); return v === undefined ? undefined : Number(v); };

if (cmd === 'list' || !cmd) { for (const f of listPayslips()) console.log(f); process.exit(0); }
if (cmd !== 'add') { console.error('usage: payslip.mjs add --month YYYY-MM --tax-month N --pay-date YYYY-MM-DD --basic N --taxable N --ytd-taxable N --net N --avc N [...]'); process.exit(2); }

const month = opt('month');
if (!month || !/^\d{4}-\d{2}$/.test(month)) { console.error('--month YYYY-MM is required'); process.exit(2); }
const taxMonth = num('tax-month');
const taxYearStart = taxMonth !== undefined ? Number(month.slice(0, 4)) - (Number(month.slice(5, 7)) < 4 || (Number(month.slice(5, 7)) === 4 && taxMonth === 12) ? 1 : 0) : NaN;
const a = (await readAssumptionsFile()).values;
const slip = {
  taxYear: opt('tax-year') ?? `${taxYearStart}/${String((taxYearStart + 1) % 100).padStart(2, '0')}`,
  taxMonth,
  payDate: opt('pay-date') ?? `${month}-28`,
  basicMonthly: num('basic'),
  taxablePayMonthly: num('taxable'),
  ytdTaxable: num('ytd-taxable'),
  netMonthly: num('net'),
  avcPct: num('avc') ?? 0,
  bonusExpected: num('bonus') ?? a.payslip.basicAnnual * a.payslip.bonusRate,
  bonusSacrificed: args.includes('--bonus-sacrificed'),
  otherTaxableIncome: num('other-income') ?? 0,
  extraAvcAlreadyTaken: num('extra-avc-taken') ?? 0,
  notes: opt('note') ?? `Entered ${new Date().toISOString().slice(0, 10)} from the ${month} payslip.`,
};
const p = writePayslip(month, slip, { force: args.includes('--force') });
console.log(`wrote ${p}`);
const basicAnnual = +(slip.basicMonthly * 12).toFixed(2);
if (Math.abs(basicAnnual - a.payslip.basicAnnual) > 1) {
  console.log(`\n!! basic on this payslip = £${basicAnnual.toLocaleString('en-GB')}/yr but plan/assumptions.json says £${a.payslip.basicAnnual.toLocaleString('en-GB')}. Update it:`);
  console.log(`   npm run plan:set -- payslip.basicAnnual ${basicAnnual} --source "Abby payslip ${month}: basic £${slip.basicMonthly}/mo x 12" --asof ${slip.payDate} --reviewby ${nextReview(slip.payDate)}`);
  console.log(`   npm run plan:set -- payslip.asOf ${month} --source "Abby payslip ${month}" --asof ${slip.payDate} --reviewby ${nextReview(slip.payDate)}`);
} else console.log(`basic matches plan/assumptions.json (£${a.payslip.basicAnnual.toLocaleString('en-GB')}/yr)`);
const r = avcRecipeFromYtd(a, slip);
const f = (/** @type {number} */ n) => '£' + Math.round(n).toLocaleString('en-GB');
console.log(`\nAVC recipe from this payslip: set ${r.avcPct}% for the remaining ${r.remaining} payslips → ANI lands ${f(r.landedAni)} (target ${f(r.target)}); take-home ~${f(r.netMonthlyAfter)}/mo; paid basic ${f(r.paidBasicAnnual)} vs NMW floor ${f(r.nmwFloor)} ${r.nmwOk ? 'OK' : 'BREACH'}`);
if (slip.avcPct !== r.avcPct) console.log(`   (payslip shows ${slip.avcPct}% — adjust in the portal)`);
console.log('\nThen: npm run plan:check');

/** @param {string} d */
function nextReview(d) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 45); return x.toISOString().slice(0, 10); }
