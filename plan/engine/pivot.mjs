// @ts-check
/**
 * The pivot: Abby salary-sacrifices to a target adjusted net income (ANI)
 * each tax year, keeping child benefit and higher-rate relief. Pure; all
 * inputs via the assumptions object `a`. £ nominal for the year in question.
 *
 * SPEC: plan/engine/SPEC.md §pivot.
 */
import { netPay, childBenefitKept, reliefOnSacrifice, nicLiableSacrifice } from './tax.mjs';

/**
 * @typedef {{ taxYear: string, yearIndex: number, basic: number, packageTotal: number, aniBefore: number,
 *   extraSacrifice: number, aniAfter: number, avcPct: number, takeHomeCut: number, cbFull: number,
 *   cbKept: number, netCost: number }} PivotYear
 */

/**
 * Nominal net pay in a programme year at a given extra sacrifice (bonus included).
 * @param {any} a @param {number} yearIndex @param {number} extraSacrifice
 */
export function takeHomeNominal(a, yearIndex, extraSacrifice) {
  const p = a.payslip;
  const basic = p.basicAnnual * Math.pow(1 + p.payGrowth, yearIndex);
  const cash = basic * (1 - p.existingEeRate) + basic * p.bonusRate + p.carAllowance - extraSacrifice;
  // From the NIC-cap year, NI is charged as if the NI-able part of the sacrifice were still cash pay.
  const niExtra = nicLiableSacrifice(a, a.pivot.firstTaxYear + yearIndex, extraSacrifice, basic * p.existingEeRate);
  const t = a.tax;
  const ni = (/** @type {number} */ base) => t.niMainRate * Math.max(0, Math.min(base, t.niUpperEarningsLimit) - t.niPrimaryThreshold) + t.niUpperRate * Math.max(0, base - t.niUpperEarningsLimit);
  const niOnExtra = niExtra > 0 ? ni(cash + niExtra) - ni(cash) : 0;
  return netPay(a, cash, cash + p.medicalBik) - niOnExtra;
}

/**
 * One programme year at a target ANI.
 * @param {any} a @param {number} yearIndex @param {number} targetAni
 * @returns {PivotYear}
 */
export function pivotYear(a, yearIndex, targetAni) {
  const p = a.payslip;
  const basic = p.basicAnnual * Math.pow(1 + p.payGrowth, yearIndex);
  const bonus = basic * p.bonusRate;
  const packageTotal = basic + bonus + p.carAllowance + p.medicalBik;
  const aniBefore = packageTotal - basic * p.existingEeRate;
  const extraSacrifice = Math.max(0, aniBefore - targetAni);
  const aniAfter = aniBefore - extraSacrifice;
  const startYear = a.pivot.firstTaxYear + yearIndex;
  const takeHomeCut = extraSacrifice - reliefOnSacrifice(a, aniBefore, extraSacrifice, { taxYearStart: startYear, existingSacrifice: basic * p.existingEeRate });
  const cbFull = a.childBenefit.annual2026 * Math.pow(1 + a.childBenefit.uprating, yearIndex);
  const cbKept = childBenefitKept(a, aniAfter, cbFull);
  return {
    taxYear: `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`,
    yearIndex, basic, packageTotal, aniBefore, extraSacrifice, aniAfter,
    avcPct: extraSacrifice > 0 ? Math.ceil((extraSacrifice / basic) * 100) : 0,
    takeHomeCut, cbFull, cbKept, netCost: takeHomeCut - cbKept,
  };
}

/**
 * The whole programme (a.pivot.years tax years from a.pivot.firstTaxYear).
 * @param {any} a @param {number} targetAni
 */
export function pivotProgramme(a, targetAni) {
  const years = Array.from({ length: a.pivot.years }, (_, i) => pivotYear(a, i, targetAni));
  return {
    years,
    totals: {
      extraSacrifice: years.reduce((s, y) => s + y.extraSacrifice, 0),
      takeHomeCut: years.reduce((s, y) => s + y.takeHomeCut, 0),
      cbKept: years.reduce((s, y) => s + y.cbKept, 0),
    },
  };
}

/**
 * The retune recipe for the UK tax year containing `today` (year 0 before the
 * programme starts); null once the programme has ended.
 * The engine never reads the clock: callers pass `today` (the run job writes it into inputs).
 * @param {any} a @param {number} targetAni @param {Date} today
 */
export function currentRetune(a, targetAni, today) {
  const y = today.getFullYear();
  const taxYearStart = today >= new Date(y, 3, 6) ? y : y - 1;
  const idx = Math.max(0, taxYearStart - a.pivot.firstTaxYear);
  if (idx >= a.pivot.years) return null;
  return pivotYear(a, idx, targetAni);
}

/**
 * The in-year AVC% recipe from a payslip observation: YTD actuals plus a
 * projection of the remaining payslips, so pay rises, backdated pay and
 * one-offs are absorbed automatically. Port of scripts/abby-avc-calculator.mjs.
 *
 * @param {any} a
 * @param {{ taxYear: string, taxMonth: number, ytdTaxable: number, basicMonthly: number, taxablePayMonthly: number,
 *   netMonthly: number, bonusExpected?: number, bonusSacrificed?: boolean, otherTaxableIncome?: number,
 *   extraAvcAlreadyTaken?: number, avcPct?: number }} slip   the latest payslip (taxablePayMonthly at AVC 0%)
 * @param {{ integerPct?: boolean }} [opts]
 */
export function avcRecipeFromYtd(a, slip, opts = {}) {
  const target = a.hicbc.operatingTarget;
  const remaining = 12 - slip.taxMonth;
  const bonusExpected = slip.bonusExpected ?? a.payslip.basicAnnual * a.payslip.bonusRate;
  const bonusInAni = slip.bonusSacrificed ? 0 : bonusExpected;
  const aniDoNothing = slip.ytdTaxable + remaining * slip.taxablePayMonthly + bonusInAni + (slip.otherTaxableIncome ?? 0) - (slip.extraAvcAlreadyTaken ?? 0);
  const extraNeeded = Math.max(0, aniDoNothing - target);
  const perPayslip = remaining > 0 ? extraNeeded / remaining : extraNeeded;
  const rawPct = (perPayslip / slip.basicMonthly) * 100;
  const avcPct = opts.integerPct === false ? Math.ceil(rawPct * 10) / 10 : Math.ceil(rawPct);
  const actualPerPayslip = (avcPct / 100) * slip.basicMonthly;
  const landedAni = aniDoNothing - actualPerPayslip * remaining;
  const paidBasicAnnual = (slip.basicMonthly * (1 - a.payslip.existingEeRate) - actualPerPayslip) * 12;
  const netCostRate = 1 - a.tax.reliefAbove;
  const netCutMonthly = actualPerPayslip * netCostRate;
  const nmwFloor = a.nmw.annualFloor;
  return {
    taxYear: slip.taxYear, taxMonth: slip.taxMonth, remaining, target,
    aniDoNothing, bonusInAni, extraNeeded, perPayslip, rawPct, avcPct, actualPerPayslip, landedAni,
    bufferBelowCliff: a.hicbc.lowerThreshold - landedAni,
    netCutMonthly, netMonthlyAfter: slip.netMonthly - netCutMonthly,
    paidBasicAnnual, nmwFloor, nmwOk: paidBasicAnnual > nmwFloor,
    aboveCliff: landedAni > a.hicbc.lowerThreshold, aboveTarget: landedAni > target,
  };
}
