#!/usr/bin/env node
// @ts-check
/**
 * Gilt ladder order sheet — index-linked gilts on Interactive Investor.
 * Replaces scripts/gilt-ladder.mjs (phase 2). Fetches the live table from
 * dividenddata.co.uk (falls back to the newest plan/observations/gilt-prices
 * file with --offline or when the fetch fails) and sizes each rung BY BUDGET.
 *
 *   npm run plan:order-sheet                                  # whole ladder, a.ladder.budgetReal
 *   npm run plan:order-sheet -- --budget 519516 --years 2035-2040   # the ISA bridge on its own budget
 *   npm run plan:order-sheet -- --budget 389874 --years 2041-2045   # the SIPP rungs
 *   npm run plan:order-sheet -- --amount 98000                 # force a fixed real redemption per year
 *   npm run plan:order-sheet -- --offline --save               # use/save observation files only
 *
 * At dealing time on II: search the EPIC, order in NOMINAL (face) amount; you
 * pay ~the dirty price per £100 face. The £ cost column is a budget, not a quote.
 */
import { readAssumptionsFile } from '../inputs/assumptions.mjs';
import { getGiltPrices } from '../inputs/gilt-prices.mjs';
import { buildLadder, couponSchedule } from '../engine/ladder.mjs';

const args = process.argv.slice(2);
const opt = (/** @type {string} */ name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const a = (await readAssumptionsFile()).values;
const prices = await getGiltPrices({ offline: args.includes('--offline'), save: args.includes('--save'), log: (m) => console.error(m) });
const years = opt('years') ? opt('years')?.split('-').map(Number) : [a.ladder.firstYear, a.ladder.lastYear];
const plan = buildLadder(a, prices.gilts, {
  firstYear: years?.[0], lastYear: years?.[1] ?? years?.[0],
  amountPerYear: opt('amount') !== undefined ? Number(opt('amount')) : undefined,
  budgetReal: opt('budget') !== undefined ? Number(opt('budget')) : undefined,
});
const fmt = (/** @type {number} */ n) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
console.log(`\nGILT LADDER ORDER SHEET — £${fmt(plan.amountPerYear)} real REDEMPTION per year, years ${plan.firstYear}–${plan.lastYear}${opt('amount') !== undefined ? ' (fixed --amount)' : ` (sized by £${fmt(opt('budget') !== undefined ? Number(opt('budget')) : a.ladder.budgetReal)} budget)`}`);
console.log(`Prices: ${prices.live ? 'LIVE ' : 'observation file ' + (prices.file ?? '')} ${prices.source ?? ''} as of ${prices.asOf}\n`);
console.log('EPIC   Gilt                                          Maturity      Dirty£   Real yld  Face to order   Est cost £   Covers');
console.log('-'.repeat(125));
for (const g of plan.byGilt) console.log(`${g.epic.padEnd(6)} ${g.giltName.padEnd(45)} ${g.maturity.padEnd(13)} ${g.dirty.toFixed(2).padStart(7)} ${String(g.realYield.toFixed(2) + '%').padStart(8)}  £${fmt(g.face).padStart(9)}    £${fmt(g.estCost).padStart(8)}   ${g.coversYears.join(', ')}${g.notes.length ? '  (' + g.notes[0] + ')' : ''}`);
console.log('-'.repeat(125));
console.log(`TOTAL${' '.repeat(85)}£${fmt(plan.totals.face).padStart(9)}    £${fmt(plan.totals.estCost).padStart(8)}\n`);
const cps = couponSchedule(plan, new Date().getFullYear() + 1);
const row = Object.entries(cps).map(([y, c]) => `${y}: £${fmt(c)}`);
console.log('Coupon top-up (real, approx, paid in two halves a year, on top of the redemptions — NOT part of the rung):');
for (let i = 0; i < row.length; i += 6) console.log('  ' + row.slice(i, i + 6).join('   '));
console.log('\nNotes:');
console.log(' - Order the FACE (nominal) amount on II; you pay ~the dirty price per £100 face. The est cost is a budget, not a quote.');
console.log(' - Index ratio estimated as dirty/clean (<1% error on these low coupons). For the exact settlement ratio see DMO daily index ratios.');
console.log(' - Cross-check the dirty price at dealing: II quote screen, or LSE (search the EPIC).');
