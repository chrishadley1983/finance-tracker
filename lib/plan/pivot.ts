/**
 * The pivot model: Abby salary-sacrifices to a target adjusted net income
 * (ANI) each tax year, keeping child benefit and 40%+2% relief.
 * Pure functions; all £ nominal for the year in question.
 */

import { PAYSLIP, TAX, HICBC, CHILD_BENEFIT, PIVOT_YEARS, PIVOT_FIRST_TAX_YEAR } from './constants';

export interface PivotYear {
  taxYear: string; // "2026/27"
  yearIndex: number;
  basic: number;
  packageTotal: number; // basic + bonus + car allowance + BIK
  aniBefore: number; // package minus existing 4.5% sacrifice
  extraSacrifice: number;
  aniAfter: number;
  avcPct: number; // ceil(extraSacrifice / basic × 100)
  takeHomeCut: number;
  cbFull: number;
  cbKept: number;
  netCost: number; // takeHomeCut − cbKept
}

export interface PivotResult {
  years: PivotYear[];
  totals: {
    extraSacrifice: number;
    takeHomeCut: number;
    cbKept: number;
  };
}

/** Child benefit kept at a given ANI, for a given full-rate amount. */
export function childBenefitKept(ani: number, fullAmount: number): number {
  if (ani <= HICBC.lowerThreshold) return fullAmount;
  if (ani >= HICBC.upperThreshold) return 0;
  const steps = Math.floor((ani - HICBC.lowerThreshold) / HICBC.stepSize);
  const kept = fullAmount * (1 - steps * HICBC.taperPerStep);
  return Math.max(0, kept);
}

/**
 * Marginal relief on sacrificed pay: 42% for pounds where taxable income sits
 * above the higher-rate floor, 28% below. Sacrifice comes off the top, so the
 * portion of the sacrifice band above the floor gets 42%.
 */
function reliefOnSacrifice(aniBefore: number, extraSacrifice: number): number {
  if (extraSacrifice <= 0) return 0;
  // Taxable income excludes nothing here (BIK is taxable); the floor applies
  // to the ANI band the sacrifice passes through.
  const bandTop = aniBefore;
  const bandBottom = aniBefore - extraSacrifice;
  const above = Math.max(0, bandTop - Math.max(bandBottom, TAX.higherRateFloor));
  const below = extraSacrifice - above;
  return above * TAX.reliefAbove + below * TAX.reliefBelow;
}

export function pivotYear(yearIndex: number, targetAni: number): PivotYear {
  const growth = Math.pow(1 + PAYSLIP.payGrowth, yearIndex);
  const basic = PAYSLIP.basicAnnual * growth;
  const bonus = basic * PAYSLIP.bonusRate;
  const packageTotal = basic + bonus + PAYSLIP.carAllowance + PAYSLIP.medicalBik;
  const aniBefore = packageTotal - basic * PAYSLIP.existingEeRate;
  const extraSacrifice = Math.max(0, aniBefore - targetAni);
  const aniAfter = aniBefore - extraSacrifice;
  const relief = reliefOnSacrifice(aniBefore, extraSacrifice);
  const takeHomeCut = extraSacrifice - relief;
  const cbFull = CHILD_BENEFIT.annual2026 * Math.pow(1 + CHILD_BENEFIT.uprating, yearIndex);
  const cbKept = childBenefitKept(aniAfter, cbFull);
  const startYear = PIVOT_FIRST_TAX_YEAR + yearIndex;
  return {
    taxYear: `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`,
    yearIndex,
    basic,
    packageTotal,
    aniBefore,
    extraSacrifice,
    aniAfter,
    avcPct: extraSacrifice > 0 ? Math.ceil((extraSacrifice / basic) * 100) : 0,
    takeHomeCut,
    cbFull,
    cbKept,
    netCost: takeHomeCut - cbKept,
  };
}

export function pivotProgramme(targetAni: number): PivotResult {
  const years = Array.from({ length: PIVOT_YEARS }, (_, i) => pivotYear(i, targetAni));
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
 * The April retune recipe for the current UK tax year (or year 0 if the
 * programme hasn't started). Returns null when the programme has ended.
 */
export function currentRetune(targetAni: number, today: Date = new Date()): PivotYear | null {
  // UK tax year starting 6 April.
  const y = today.getFullYear();
  const taxYearStart = today >= new Date(y, 3, 6) ? y : y - 1;
  const idx = Math.max(0, taxYearStart - PIVOT_FIRST_TAX_YEAR);
  if (idx >= PIVOT_YEARS) return null;
  return pivotYear(idx, targetAni);
}
