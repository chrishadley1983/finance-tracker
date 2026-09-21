// @ts-check
/**
 * Outlook models: pots at exit, sustainable spend, and the three-bucket
 * drawdown simulation behind "surplus at 92". Today's money. Pure; all
 * inputs via the assumptions object `a`. Port of lib/plan/outlook.ts.
 *
 * SPEC: plan/engine/SPEC.md §outlook.
 */
import { annuity } from './tax.mjs';
import { pivotYear, takeHomeNominal } from './pivot.mjs';

/**
 * @typedef {{ retireYear: number, realReturn: number, retirementSpend: number, aniTarget: number, hbPostRetirement: number,
 *   potsOverride?: { chrisPension: number, abbyPension: number, nonPension: number, total: number } }} OutlookOptions
 */

/** @param {any} a @returns {OutlookOptions} */
export function defaultOutlook(a) {
  return {
    retireYear: a.dates.planRetirementYear,
    realReturn: a.returns.realEquity.planning,
    retirementSpend: a.spend.retirementTarget,
    aniTarget: a.hicbc.lowerThreshold, // modelled to the line; operated to a.hicbc.operatingTarget
    hbPostRetirement: a.income.hbPostRetirement,
  };
}

const BASE_YEAR = 2026;

/**
 * Real pre-retirement cash surplus(+)/deficit(−) for working-year index i, at the plan's HB target.
 * @param {any} a @param {number} i @param {number} aniTarget
 */
export function workingYearCashDelta(a, i, aniTarget) {
  const y = pivotYear(a, i, aniTarget);
  const takeHomeReal = takeHomeNominal(a, i, y.extraSacrifice) / Math.pow(1 + a.payslip.payGrowth, i);
  return takeHomeReal + a.childBenefit.annual2026 + a.income.hbPreRetirement - a.spend.planLine;
}

/** @param {any} a @param {OutlookOptions} opts */
export function potsAtExit(a, opts) {
  const n = opts.retireYear - BASE_YEAR;
  const r = opts.realReturn;
  const gf = Math.pow(1 + r, n);
  const chrisPension = a.pots.chrisPension * gf;
  let abbyPension = a.pots.abbyPension * gf;
  let nonPension = a.pots.nonPension * gf;
  const existingReal = a.payslip.basicAnnual * (a.payslip.employerRate + a.payslip.existingEeRate);
  for (let i = 0; i < n; i++) {
    const growTo = Math.pow(1 + r, n - 0.5 - i); // mid-year contributions
    const y = pivotYear(a, i, opts.aniTarget);
    const extraReal = y.extraSacrifice / Math.pow(1 + a.payslip.payGrowth, i);
    abbyPension += (existingReal + extraReal) * growTo;
    nonPension += workingYearCashDelta(a, i, opts.aniTarget) * growTo;
  }
  return { chrisPension, abbyPension, nonPension, total: chrisPension + abbyPension + nonPension };
}

/** Level real spend sustainable from exit to the horizon, running wealth to ~zero. @param {any} a @param {OutlookOptions} opts */
export function sustainableSpend(a, opts) {
  const pots = potsAtExit(a, opts);
  const g = opts.realReturn;
  const N = a.dates.simulationEndYear - opts.retireYear;
  const aN = annuity(N, g);
  const spDelay = (/** @type {number} */ startYear) => Math.max(0, startYear + 1 - opts.retireYear);
  const pvChrisSp = a.statePension.annualEach * (aN - annuity(spDelay(a.dates.chrisStatePensionYear), g));
  const pvAbbySp = a.statePension.annualEach * (aN - annuity(spDelay(a.dates.abbyStatePensionYear), g));
  const hbYears = opts.retireYear >= a.dates.planRetirementYear ? Math.max(0, a.dates.chrisPensionAccessYear + 1 - opts.retireYear) : 0;
  const pvHb = opts.hbPostRetirement * annuity(hbYears, g);
  return (pots.total + pvChrisSp + pvAbbySp + pvHb) / aN;
}

/**
 * Year-by-year drawdown from exit to the horizon, tax-minimising order:
 * UFPLS to fill both personal allowances → tax-free cash strips → non-pension
 * → taxed draws last (basic rate on the taxable fraction).
 * @param {any} a @param {OutlookOptions} opts
 */
export function drawdownSim(a, opts) {
  const pots = opts.potsOverride ?? potsAtExit(a, opts);
  const g = 1 + opts.realReturn;
  const PA = a.tax.personalAllowance;
  const U = { C: pots.chrisPension, A: pots.abbyPension };
  const D = { C: 0, A: 0 };
  const cap = { C: a.drawdown.tfcCapEach, A: a.drawdown.tfcCapEach };
  let NP = pots.nonPension;
  let totalTax = 0, pensionWithdrawn = 0;
  /** @type {number|null} */ let firstTaxedYear = null;
  /** @type {number|null} */ let depletedYear = null;
  const fundingByYear = [];
  for (let year = opts.retireYear; year <= a.dates.simulationEndYear; year++) {
    const hb = opts.retireYear >= a.dates.planRetirementYear && year <= a.dates.chrisPensionAccessYear ? opts.hbPostRetirement : 0;
    const sp = { C: year > a.dates.chrisStatePensionYear ? a.statePension.annualEach : 0, A: year > a.dates.abbyStatePensionYear ? a.statePension.annualEach : 0 };
    const access = { C: year > a.dates.chrisPensionAccessYear, A: year > a.dates.abbyPensionAccessYear };
    let cash = hb + sp.C + sp.A;
    const row = { year, hb, statePension: sp.C + sp.A, chrisPensionDraw: 0, abbyPensionDraw: 0, ladderDraw: 0, isaDraw: 0, nonPensionDraw: 0, tax: 0 };
    for (const p of /** @type {const} */ (['C', 'A'])) {
      if (!access[p] || U[p] <= 0) continue;
      const otherTaxable = sp[p] + (p === 'C' ? hb : 0);
      const head = Math.max(0, PA - otherTaxable);
      const w = Math.min(U[p], (head * 4) / 3, cap[p] * 4);
      U[p] -= w; cap[p] -= 0.25 * w; cash += w; pensionWithdrawn += w;
      if (p === 'C') row.chrisPensionDraw += w; else row.abbyPensionDraw += w;
    }
    let need = opts.retirementSpend - cash;
    if (need > 0) {
      for (const p of /** @type {const} */ (['C', 'A'])) {
        if (need <= 0 || !access[p] || U[p] <= 0 || cap[p] <= 0) continue;
        const s = Math.min(need, cap[p], U[p] * 0.25);
        const X = s * 4;
        U[p] -= X; D[p] += 0.75 * X; cap[p] -= s; cash += s; need -= s; pensionWithdrawn += s;
        if (p === 'C') row.chrisPensionDraw += s; else row.abbyPensionDraw += s;
      }
      if (need > 0) {
        const t = Math.min(need, NP);
        NP -= t; need -= t; row.nonPensionDraw += t;
        if (year <= a.ladder.lastYear) row.ladderDraw += t; else row.isaDraw += t;
      }
      for (const p of /** @type {const} */ (['C', 'A'])) {
        if (need <= 0 || !access[p]) continue;
        for (const [pot, taxableFrac] of /** @type {const} */ ([[D, 1], [U, a.drawdown.ufplsTaxableFraction]])) {
          if (need <= 0 || pot[p] <= 0) continue;
          const netRate = 1 - a.tax.basicRate * taxableFrac;
          const gross = Math.min(pot[p], need / netRate);
          pot[p] -= gross;
          const t = gross * taxableFrac * a.tax.basicRate;
          totalTax += t; row.tax += t;
          if (t > 0 && firstTaxedYear === null) firstTaxedYear = year;
          cash += gross - t; need -= gross - t; pensionWithdrawn += gross;
          if (pot === U) cap[p] -= 0.25 * gross;
          if (p === 'C') row.chrisPensionDraw += gross; else row.abbyPensionDraw += gross;
        }
      }
      if (need > 1 && depletedYear === null) depletedYear = year;
    } else {
      NP += -need;
    }
    U.C *= g; U.A *= g; D.C *= g; D.A *= g; NP *= g;
    fundingByYear.push(row);
  }
  const chrisPensionAt92 = U.C + D.C, abbyPensionAt92 = U.A + D.A;
  return {
    surplusAt92: chrisPensionAt92 + abbyPensionAt92 + NP, chrisPensionAt92, abbyPensionAt92, nonPensionAt92: NP,
    firstTaxedYear, depletedYear, totalTax, pensionWithdrawn, effectiveTaxRate: pensionWithdrawn > 0 ? totalTax / pensionWithdrawn : 0, fundingByYear,
  };
}
