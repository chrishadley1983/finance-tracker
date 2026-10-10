/**
 * Golden hand-derivations (plan/derivations/golden.json). Each expected value
 * was produced outside the engine; the working is in the named .md file.
 * Consistency is not correctness — these are what make the model right.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import golden from '../../../plan/derivations/golden.json';
import assumptionsFile from '../../../plan/assumptions.json';
import fallback from '../../../plan/observations/gilt-prices/2026-07-29.json';
import yields from '../../../plan/observations/gilt-yields/2026-09-20.json';
import payslipAug from '../../../plan/observations/payslips/2026-08.json';
import { buildAssumptions } from '../../../plan/inputs/assumptions.mjs';
import { netPay, childBenefitKept, annuity } from '../../../plan/engine/tax.mjs';
import { pivotYear, pivotProgramme, takeHomeNominal, avcRecipeFromYtd } from '../../../plan/engine/pivot.mjs';
import { buildLadder, sizeByBudget } from '../../../plan/engine/ladder.mjs';
import { runLedger } from '../../../plan/engine/ledger.mjs';

const a = buildAssumptions(assumptionsFile as never).values;
const root = path.resolve(__dirname, '../../..');

const cashApr = (5825 * 0.955 + 541.67) * 12, cashAug = (6153.15 * 0.955 + 541.67) * 12;
const sixty = buildLadder(a, fallback.gilts as never, { amountPerYear: 60_000 });
const tr40 = sixty.byGilt.find((g) => g.epic === 'TR40')!;
const fixture = [
  { epic: 'A', name: 'A', coupon: '0.5%', maturity: '22-Mar-2035', matYear: 2035, clean: 80, dirty: 120, realYield: 2 },
  { epic: 'B', name: 'B', coupon: '0.5%', maturity: '22-Mar-2036', matYear: 2036, clean: 60, dirty: 100, realYield: 2 },
];
const ledger = runLedger(a, yields as never);
const row2027 = ledger.rows.find((r: { year: number }) => r.year === 2027)!;

const actual: Record<string, () => number> = {
  'netpay-apr-2026': () => netPay(a, cashApr, cashApr + 110.83 * 12) / 12,
  'netpay-aug-2026': () => netPay(a, cashAug, cashAug + 110.83 * 12) / 12,
  'pivot-2026-27-extra-at-60k': () => pivotYear(a, 0, 60_000).extraSacrifice,
  'pivot-2034-35-extra-at-60k': () => pivotYear(a, 8, 60_000).extraSacrifice,
  'pivot-nine-year-total-at-60k': () => pivotProgramme(a, 60_000).totals.extraSacrifice,
  'takehome-year1-at-60k-line': () => takeHomeNominal(a, 0, pivotYear(a, 0, 60_000).extraSacrifice),
  'hicbc-half-at-70k': () => childBenefitKept(a, 70_000, 2337.4) / 2337.4,
  'hicbc-one-step-at-60200': () => childBenefitKept(a, 60_200, 2337.4) / 2337.4,
  'child-benefit-2026-27': () => a.childBenefit.annual2026,
  'tr40-face-at-60k': () => tr40.face,
  'tr40-cost-at-60k': () => tr40.estCost,
  'size-by-budget-two-gilt-fixture': () => sizeByBudget(fixture, 140_000, { firstYear: 2035, lastYear: 2036 }),
  'annuity-40y-2pct': () => annuity(40, 0.02),
  'nmw-annual-floor-40h': () => a.nmw.annualFloor,
  'avc-recipe-aug-2026': () => avcRecipeFromYtd(a, payslipAug as never).avcPct,
  'ledger-2027-isa-ladder': () => row2027.isaLadC + row2027.isaLadA,
};

describe('golden hand-derivations (plan/derivations)', () => {
  for (const g of golden.goldens) {
    it(`${g.id}: ${g.check} ≈ ${g.expected} ±${g.tol} (${g.file})`, () => {
      expect(actual[g.id], `no evaluator for golden ${g.id}`).toBeDefined();
      expect(fs.existsSync(path.join(root, 'plan/derivations', g.file)), `derivation file ${g.file} missing`).toBe(true);
      const v = actual[g.id]();
      expect(Math.abs(v - g.expected), `${g.id}: got ${v}`).toBeLessThanOrEqual(g.tol);
    });
  }
  it('every evaluator has a golden entry (no silent drift in the test itself)', () => {
    expect(Object.keys(actual).sort()).toEqual(golden.goldens.map((g) => g.id).sort());
  });
});
