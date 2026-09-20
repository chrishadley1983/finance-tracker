// Abby AVC% calculator — HICBC salary sacrifice (Amendment 1).
// Works from PAYSLIP YTD ACTUALS + projection of remaining months, so
// pay rises, backdated pay, and one-offs are absorbed automatically.
//
// Run: node scripts/abby-avc-calculator.mjs
// Update CONFIG from the latest payslip each time (September start,
// January true-up when bonus is known, every April for the new year).
//
// ANI = taxable pay for the year (Accenture payrolls the medical BIK, so
// payslip "Taxable pay" already includes it) + any non-payroll income
// (savings interest / dividends in her name) − further sacrifice.

// Phase 1 (20 Sep 2026): the target, relief rate and existing sacrifice come from
// plan/assumptions.json so this tool and the /plan cockpit cannot disagree. The
// payslip YTD figures below stay here until phase 3 moves them to
// plan/observations/payslips/. This tool folds into plan/tools/avc.mjs in phase 2.
import { readAssumptionsFile } from '../plan/inputs/assumptions.mjs';
const A = (await readAssumptionsFile()).values;

const CONFIG = {
  taxYear: '2026/27',
  targetANI: A.hicbc.operatingTarget, // operate £500 under the £60,000 cliff (hicbc.operatingTarget)
  // --- from the latest payslip (Aug 2026, Tax Month 05) ---
  ytdTaxable: 33_621.44,        // "Taxable Pay" YTD — after sacrifice, incl. BIK
  monthlyBasic: 6_153.15,       // current basic (rise landed since April)
  monthlyTaxable: 6_528.76,     // this month's taxable pay at AVC 0%
  monthsPaid: 5,                // tax months already paid (Apr–Aug)
  currentNetMonthly: 4_511.60,  // take-home at AVC 0%
  // --- projections / to verify ---
  bonusExpected: 0.05 * 73_837.80, // GUESS 5% of new basic — true up in January
  bonusSacrificed: false,       // set true if portal confirms bonus sacrificeable
  otherTaxableIncome: 0,        // CHECK — interest/dividends in HER name
  extraAvcAlreadyTaken: 0,      // £ of AVC sacrificed so far this year
  // --- mechanics ---
  avcPctIsInteger: true,
  netCostRate: 1 - A.tax.reliefAbove, // £ take-home lost per £1 sacrificed (1 − 42%: 40% tax + 2% NI)
  existingSacrificePct: A.payslip.existingEeRate,
  nmwAnnualFloor: 26_510,       // 40h × £12.71 (NMW 21+, Apr 2026) × 52.14 — re-index every April; was 25,500 (2025/26 rate)
};

const c = CONFIG;
const remaining = 12 - c.monthsPaid;
const bonusInAni = c.bonusSacrificed ? 0 : c.bonusExpected;
const aniDoNothing =
  c.ytdTaxable + remaining * c.monthlyTaxable + bonusInAni +
  c.otherTaxableIncome - c.extraAvcAlreadyTaken;

const extraNeeded = Math.max(0, aniDoNothing - c.targetANI);
const perPayslip = extraNeeded / remaining;
const rawPct = (perPayslip / c.monthlyBasic) * 100;
const avcPct = c.avcPctIsInteger ? Math.ceil(rawPct) : Math.ceil(rawPct * 10) / 10;
const actualPerPayslip = (avcPct / 100) * c.monthlyBasic;
const landedANI = aniDoNothing - actualPerPayslip * remaining;
const paidBasicAnnual = (c.monthlyBasic * (1 - c.existingSacrificePct) - actualPerPayslip) * 12;
const netCutMonthly = actualPerPayslip * c.netCostRate;

const f = n => '£' + Math.round(n).toLocaleString('en-GB');
console.log(`=== Abby AVC calculator — ${c.taxYear} (from Tax Month ${String(c.monthsPaid).padStart(2, '0')} YTD) ===\n`);
console.log(`YTD taxable (actual):          ${f(c.ytdTaxable)}`);
console.log(`+ ${remaining} months at current pay:    ${f(remaining * c.monthlyTaxable)}`);
console.log(`+ bonus ${c.bonusSacrificed ? '(sacrificed, excluded)' : '(GUESS, in ANI)     '}    ${f(bonusInAni)}`);
console.log(`Projected ANI doing nothing:   ${f(aniDoNothing)}`);
console.log(`Extra sacrifice still needed:  ${f(extraNeeded)} over ${remaining} payslips (${f(perPayslip)}/mo exact, ${rawPct.toFixed(2)}%)`);
console.log(`\n>>> SET AVC TO ${avcPct}% <<<  (${f(actualPerPayslip)}/payslip)\n`);
console.log(`ANI lands at:                  ${f(landedANI)}  (buffer ${f(60_000 - landedANI)} below the cliff)`);
console.log(`Take-home cut:                 ~${f(netCutMonthly)}/mo  (${f(c.currentNetMonthly)} -> ~${f(c.currentNetMonthly - netCutMonthly)})`);
console.log(`Post-sacrifice paid basic:     ${f(paidBasicAnnual)}/yr  (NMW floor ~${f(c.nmwAnnualFloor)}: ${paidBasicAnnual > c.nmwAnnualFloor ? 'OK' : 'BREACH — reduce AVC, sacrifice bonus instead'})`);
if (landedANI > 60_000) console.log('\n!! ANI still above £60,000 — AVC alone cannot get there; sacrifice bonus or add a lump-sum contribution.');
else if (landedANI > c.targetANI) console.log('\n!! Above the £59.5k operating target — full CB still kept but buffer is thin.');
