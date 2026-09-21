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
 * @param {any} a
 * @param {number} taxableIncome
 */
export function personTax(a, taxableIncome) {
  const t = a.tax;
  return (
    t.basicRate * Math.max(0, Math.min(taxableIncome, t.higherRateFloor) - t.personalAllowance) +
    t.higherRate * Math.max(0, taxableIncome - t.higherRateFloor)
  );
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
 * Marginal relief on sacrificed pay: reliefAbove for pounds where taxable
 * income sits above the higher-rate floor, reliefBelow beneath it. Sacrifice
 * comes off the top, so the part of the band above the floor gets the higher rate.
 * @param {any} a
 * @param {number} aniBefore
 * @param {number} extraSacrifice
 */
export function reliefOnSacrifice(a, aniBefore, extraSacrifice) {
  if (extraSacrifice <= 0) return 0;
  const t = a.tax;
  const bandBottom = aniBefore - extraSacrifice;
  const above = Math.max(0, aniBefore - Math.max(bandBottom, t.higherRateFloor));
  const below = extraSacrifice - above;
  return above * t.reliefAbove + below * t.reliefBelow;
}

/** Present value of £1 a year for n years at rate g (ordinary annuity). @param {number} n @param {number} g */
export function annuity(n, g) {
  if (n <= 0) return 0;
  if (g === 0) return n;
  return (1 - Math.pow(1 + g, -n)) / g;
}
