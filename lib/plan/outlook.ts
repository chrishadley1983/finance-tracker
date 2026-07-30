/**
 * Outlook models: pots at exit, sustainable spend, and the drawdown
 * simulation behind "surplus at 92". All in today's money (real terms);
 * deterministic ports of the July 2026 plan's session models.
 */

import {
  POTS_BASELINE,
  DATES,
  STATE_PENSION,
  TAX,
  DRAWDOWN,
  INCOME,
  SPEND,
} from './constants';
import { pivotYear } from './pivot';

export interface OutlookOptions {
  retireYear: number; // June of this year, 2031–2035
  realReturn: number; // 0.02 or 0.04
  retirementSpend: number; // £/yr real, default 60_000
  aniTarget: number; // pivot target while working, default 60_000
  hbPostRetirement: number; // £/yr to Nov 2040 — only paid when retiring on plan (2035)
  /** Pin the at-exit pots (e.g. to reproduce the July doc's published sim). */
  potsOverride?: PotsAtExit;
}

export const DEFAULT_OUTLOOK: OutlookOptions = {
  retireYear: DATES.planRetirementYear,
  realReturn: 0.02,
  retirementSpend: SPEND.retirementTarget,
  aniTarget: 60_000,
  hbPostRetirement: INCOME.hbPostRetirement,
};

const BASE_YEAR = 2026;

/** Annuity factor: PV of £1/yr for n years at rate g. */
function annuity(n: number, g: number): number {
  if (n <= 0) return 0;
  if (g === 0) return n;
  return (1 - Math.pow(1 + g, -n)) / g;
}

/** Real pre-retirement cash surplus(+)/deficit(−) for working-year index i (0 = 2026/27), at £25k HB. */
function workingYearCashDelta(i: number, aniTarget: number): number {
  const y = pivotYear(i, aniTarget);
  const extraReal = y.extraSacrifice / Math.pow(1.02, i); // deflate nominal to today's £
  const takeHomeReal = 53_988 - 0.58 * extraReal; // £43.5k at £18.1k sacrifice
  const income = takeHomeReal + 2_337 + INCOME.hbPreRetirement;
  return income - SPEND.planLine;
}

export interface PotsAtExit {
  chrisPension: number;
  abbyPension: number;
  nonPension: number;
  total: number;
}

export function potsAtExit(opts: OutlookOptions): PotsAtExit {
  const n = opts.retireYear - BASE_YEAR;
  const r = opts.realReturn;
  const gf = Math.pow(1 + r, n);

  const chrisPension = POTS_BASELINE.chrisPension * gf;

  let abbyPension = POTS_BASELINE.abbyPension * gf;
  let nonPension = POTS_BASELINE.nonPension * gf;
  for (let i = 0; i < n; i++) {
    const growTo = Math.pow(1 + r, n - 0.5 - i); // mid-year contributions
    const y = pivotYear(i, opts.aniTarget);
    const extraReal = y.extraSacrifice / Math.pow(1.02, i);
    abbyPension += (10_834 + extraReal) * growTo;
    nonPension += workingYearCashDelta(i, opts.aniTarget) * growTo;
  }
  return { chrisPension, abbyPension, nonPension, total: chrisPension + abbyPension + nonPension };
}

/**
 * Level real spend sustainable from exit to the simulation horizon (Chris 92),
 * running wealth to ~zero: annuitise wealth plus the PV of state pensions and
 * any post-retirement HB.
 */
export function sustainableSpend(opts: OutlookOptions): number {
  const pots = potsAtExit(opts);
  const g = opts.realReturn;
  const N = DATES.simulationEndYear - opts.retireYear;
  const aN = annuity(N, g);

  const spDelay = (startYear: number) => Math.max(0, startYear + 1 - opts.retireYear);
  const pvChrisSp = STATE_PENSION.annualEach * (aN - annuity(spDelay(DATES.chrisStatePensionYear), g));
  const pvAbbySp = STATE_PENSION.annualEach * (aN - annuity(spDelay(DATES.abbyStatePensionYear), g));

  const hbYears =
    opts.retireYear >= DATES.planRetirementYear
      ? Math.max(0, DATES.chrisPensionAccessYear + 1 - opts.retireYear)
      : 0; // early exit assumes HB stops too
  const pvHb = opts.hbPostRetirement * annuity(hbYears, g);

  return (pots.total + pvChrisSp + pvAbbySp + pvHb) / aN;
}

export interface DrawdownResult {
  surplusAt92: number;
  chrisPensionAt92: number;
  abbyPensionAt92: number;
  nonPensionAt92: number;
  firstTaxedYear: number | null;
  totalTax: number;
  pensionWithdrawn: number;
  effectiveTaxRate: number; // tax ÷ pension withdrawals
  /** First year the money cannot fully fund the spend (null = never before 2075). */
  depletedYear: number | null;
  fundingByYear: Array<{
    year: number;
    hb: number;
    statePension: number;
    chrisPensionDraw: number;
    abbyPensionDraw: number;
    /** Non-pension draw in ladder years (≤ 2045): the maturing gilt rungs. */
    ladderDraw: number;
    /** Non-pension draw after the ladder ends: ISA / cash. */
    isaDraw: number;
    nonPensionDraw: number;
    tax: number;
  }>;
}

/**
 * Year-by-year drawdown from exit to 2075, tax-minimising order:
 * UFPLS slices to fill both personal allowances (0%) → tax-free cash strips
 * (0%) → non-pension (0%) → taxed draws last (basic rate on the 75%).
 */
export function drawdownSim(opts: OutlookOptions): DrawdownResult {
  const pots = opts.potsOverride ?? potsAtExit(opts);
  const g = 1 + opts.realReturn;
  const PA = TAX.personalAllowance;

  // Uncrystallised pots, crystallised-taxable remainders, TFC caps.
  const U = { C: pots.chrisPension, A: pots.abbyPension };
  const D = { C: 0, A: 0 };
  const cap = { C: DRAWDOWN.tfcCapEach, A: DRAWDOWN.tfcCapEach };
  let NP = pots.nonPension;

  let totalTax = 0;
  let pensionWithdrawn = 0;
  let firstTaxedYear: number | null = null;
  let depletedYear: number | null = null;
  const fundingByYear: DrawdownResult['fundingByYear'] = [];

  for (let year = opts.retireYear; year <= DATES.simulationEndYear; year++) {
    const hb =
      opts.retireYear >= DATES.planRetirementYear && year <= DATES.chrisPensionAccessYear
        ? opts.hbPostRetirement
        : 0;
    const sp = {
      C: year > DATES.chrisStatePensionYear ? STATE_PENSION.annualEach : 0,
      A: year > DATES.abbyStatePensionYear ? STATE_PENSION.annualEach : 0,
    };
    const access = {
      C: year > DATES.chrisPensionAccessYear,
      A: year > DATES.abbyPensionAccessYear,
    };

    let cash = hb + sp.C + sp.A;
    const row = {
      year,
      hb,
      statePension: sp.C + sp.A,
      chrisPensionDraw: 0,
      abbyPensionDraw: 0,
      ladderDraw: 0,
      isaDraw: 0,
      nonPensionDraw: 0,
      tax: 0,
    };

    // 1) UFPLS to fill each personal allowance (0% tax).
    for (const p of ['C', 'A'] as const) {
      if (!access[p] || U[p] <= 0) continue;
      const otherTaxable = sp[p] + (p === 'C' ? hb : 0);
      const head = Math.max(0, PA - otherTaxable);
      const w = Math.min(U[p], (head * 4) / 3, cap[p] * 4);
      U[p] -= w;
      cap[p] -= 0.25 * w;
      cash += w;
      pensionWithdrawn += w;
      if (p === 'C') row.chrisPensionDraw += w;
      else row.abbyPensionDraw += w;
    }

    let need = opts.retirementSpend - cash;
    if (need > 0) {
      // 2) Tax-free cash strips.
      for (const p of ['C', 'A'] as const) {
        if (need <= 0 || !access[p] || U[p] <= 0 || cap[p] <= 0) continue;
        const s = Math.min(need, cap[p], U[p] * 0.25);
        const X = s * 4;
        U[p] -= X;
        D[p] += 0.75 * X;
        cap[p] -= s;
        cash += s;
        need -= s;
        pensionWithdrawn += s;
        if (p === 'C') row.chrisPensionDraw += s;
        else row.abbyPensionDraw += s;
      }
      // 3) Non-pension: the maturing gilt rungs in ladder years, ISA/cash after.
      if (need > 0) {
        const t = Math.min(need, NP);
        NP -= t;
        need -= t;
        row.nonPensionDraw += t;
        if (year <= 2045) row.ladderDraw += t;
        else row.isaDraw += t;
      }
      // 4) Taxed pension draws (crystallised first, then UFPLS beyond PA).
      for (const p of ['C', 'A'] as const) {
        if (need <= 0 || !access[p]) continue;
        for (const [pot, taxableFrac] of [
          [D, 1] as const,
          [U, DRAWDOWN.ufplsTaxableFraction] as const,
        ]) {
          if (need <= 0 || pot[p] <= 0) continue;
          const netRate = 1 - TAX.basicRate * taxableFrac;
          const gross = Math.min(pot[p], need / netRate);
          pot[p] -= gross;
          const t = gross * taxableFrac * TAX.basicRate;
          totalTax += t;
          row.tax += t;
          if (t > 0 && firstTaxedYear === null) firstTaxedYear = year;
          cash += gross - t;
          need -= gross - t;
          pensionWithdrawn += gross;
          if (pot === U) cap[p] -= 0.25 * gross;
          if (p === 'C') row.chrisPensionDraw += gross;
          else row.abbyPensionDraw += gross;
        }
      }
      if (need > 1 && depletedYear === null) depletedYear = year;
    } else {
      NP += -need; // surplus recycled
    }

    U.C *= g;
    U.A *= g;
    D.C *= g;
    D.A *= g;
    NP *= g;
    fundingByYear.push(row);
  }

  const chrisPensionAt92 = U.C + D.C;
  const abbyPensionAt92 = U.A + D.A;
  return {
    surplusAt92: chrisPensionAt92 + abbyPensionAt92 + NP,
    chrisPensionAt92,
    abbyPensionAt92,
    nonPensionAt92: NP,
    firstTaxedYear,
    depletedYear,
    totalTax,
    pensionWithdrawn,
    effectiveTaxRate: pensionWithdrawn > 0 ? totalTax / pensionWithdrawn : 0,
    fundingByYear,
  };
}
