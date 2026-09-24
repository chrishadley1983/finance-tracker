// @ts-check
/**
 * UK PAYE / NI / HICBC arithmetic used by the plan. Pure; every rate and
 * threshold comes from the injected assumptions object `a` (the `values`
 * returned by plan/inputs/assumptions.mjs), never from a literal here.
 *
 * SPEC: see plan/engine/SPEC.md §tax.
 */

/**
 * Annual net pay for a given cash pay (after all salary sacrifice) and taxable
 * pay (cash + payrolled benefits). Income tax at the PAYE allowance in the
 * assumptions (Abby's tax code), employee NI on cash pay only.
 * Reconciles the Apr and Aug 2026 payslips to within 40p/month.
 * @param {any} a
 * @param {number} cashPay
 * @param {number} taxablePay
 */
export function netPay(a, cashPay, taxablePay) {
  const t = a.tax;
  const taxable = Math.max(0, taxablePay - t.payeAllowance);
  const tax = t.basicRate * Math.min(taxable, t.basicRateBand) + t.higherRate * Math.max(0, taxable - t.basicRateBand);
  const ni =
    t.niMainRate * Math.max(0, Math.min(cashPay, t.niUpperEarningsLimit) - t.niPrimaryThreshold) +
    t.niUpperRate * Math.max(0, cashPay - t.niUpperEarningsLimit);
  return cashPay - tax - ni;
}

/**
 * Income tax on a person's taxable income in retirement (full personal
 * allowance, basic rate to the higher-rate floor, higher rate above).
 * `scale` multiplies both thresholds — pass thresholdScale(a, year) to get
 * today's-money thresholds that are frozen in cash (default 1 = 2026/27 values).
 * @param {any} a
 * @param {number} taxableIncome
 * @param {number} [scale]
 */
export function personTax(a, taxableIncome, scale = 1) {
  const t = a.tax;
  return (
    t.basicRate * Math.max(0, Math.min(taxableIncome, t.higherRateFloor * scale) - t.personalAllowance * scale) +
    t.higherRate * Math.max(0, taxableIncome - t.higherRateFloor * scale)
  );
}

/**
 * Today's-money value of £1 of an amount frozen in cash from the base year
 * (2026/27) through tax year `frozenThrough` and CPI-indexed afterwards;
 * `frozenThrough` = Infinity for amounts frozen indefinitely (the lump sum
 * allowance). Row year y is read as tax year y/y+1.
 * @param {any} a @param {number} year @param {number} frozenThrough @param {number} [base]
 */
export function frozenInCash(a, year, frozenThrough, base = 2026) {
  return Math.pow(1 + a.returns.cpi, -(Math.max(base, Math.min(year, frozenThrough)) - base));
}

/** Real-terms scale for the income tax personal allowance and higher-rate threshold in row year `year`. @param {any} a @param {number} year */
export function thresholdScale(a, year) {
  return frozenInCash(a, year, a.tax.thresholdsFrozenThroughTaxYear);
}

/**
 * Child benefit kept at a given adjusted net income under the High Income
 * Child Benefit Charge taper.
 * @param {any} a
 * @param {number} ani
 * @param {number} fullAmount
 */
export function childBenefitKept(a, ani, fullAmount) {
  const h = a.hicbc;
  if (ani <= h.lowerThreshold) return fullAmount;
  if (ani >= h.upperThreshold) return 0;
  const steps = Math.floor((ani - h.lowerThreshold) / h.stepSize);
  return Math.max(0, fullAmount * (1 - steps * h.taperPerStep));
}

/**
 * The part of a year's total salary sacrifice that attracts NI once the
 * salary-sacrifice NIC cap applies (Autumn Budget 2025: from 2029/30, pension
 * salary sacrifice above a.tax.salarySacrificeNicCapThreshold a year is
 * NI-able). Before the start year, nothing. Applied to the EXTRA sacrifice on
 * the basis that the existing payroll sacrifice already uses up the threshold.
 * @param {any} a @param {number} taxYearStart @param {number} extraSacrifice @param {number} existingSacrifice
 */
export function nicLiableSacrifice(a, taxYearStart, extraSacrifice, existingSacrifice) {
  const t = a.tax;
  if (taxYearStart < t.salarySacrificeNicCapFromTaxYear) return 0;
  const headroom = Math.max(0, t.salarySacrificeNicCapThreshold - existingSacrifice);
  return Math.max(0, extraSacrifice - headroom);
}

/**
 * Marginal relief on sacrificed pay: reliefAbove for pounds where taxable
 * income sits above the higher-rate floor, reliefBelow beneath it. Sacrifice
 * comes off the top, so the part of the band above the floor gets the higher
 * rate. From the NIC-cap year the NI element of the relief is lost on the
 * NI-able part (2% above the UEL, 8% below).
 * @param {any} a
 * @param {number} aniBefore
 * @param {number} extraSacrifice
 * @param {{ taxYearStart?: number, existingSacrifice?: number }} [ctx]
 */
export function reliefOnSacrifice(a, aniBefore, extraSacrifice, ctx = {}) {
  if (extraSacrifice <= 0) return 0;
  const t = a.tax;
  const bandBottom = aniBefore - extraSacrifice;
  const above = Math.max(0, aniBefore - Math.max(bandBottom, t.higherRateFloor));
  const below = extraSacrifice - above;
  let relief = above * t.reliefAbove + below * t.reliefBelow;
  if (ctx.taxYearStart !== undefined) {
    const liable = nicLiableSacrifice(a, ctx.taxYearStart, extraSacrifice, ctx.existingSacrifice ?? 0);
    if (liable > 0) {
      // the NI-able pounds sit at the top of the sacrifice band: lose 2% up to `above`, then 8%
      const liableAbove = Math.min(liable, above), liableBelow = liable - liableAbove;
      relief -= liableAbove * t.niUpperRate + liableBelow * t.niMainRate;
    }
  }
  return relief;
}

/** Present value of £1 a year for n years at rate g (ordinary annuity). @param {number} n @param {number} g */
export function annuity(n, g) {
  if (n <= 0) return 0;
  if (g === 0) return n;
  return (1 - Math.pow(1 + g, -n)) / g;
}
