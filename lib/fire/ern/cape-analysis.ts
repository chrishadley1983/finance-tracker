import type { CohortResult, CapeWithdrawalPoint } from './types';

/** Maximum withdrawal rate cap to prevent catastrophic depletion at extreme low CAPE */
const WR_CAP = 10;

/**
 * Compute ERN's dynamic withdrawal rate based on CAPE.
 *
 * Formula: WR = 1.75 + 0.50 × (100 / CAPE)
 * ERN Parts 18 & 54: intercept = 1.75%, slope = 0.50
 *
 * Capped at WR_CAP (10%) per Phase A finding from Part 54
 * to prevent extreme withdrawals when CAPE drops to single digits.
 *
 * @param cape - Current CAPE ratio
 * @returns Annual withdrawal rate as percentage
 */
export function computeErnDynamicWr(cape: number): number {
  if (cape <= 0) return 0;
  const wr = 1.75 + 0.50 * (100 / cape);
  return Math.min(wr, WR_CAP);
}

/**
 * Generate the CAPE-based dynamic withdrawal rate curve.
 *
 * Returns data points for the ERN CAPE withdrawal chart.
 *
 * @param minCape - Starting CAPE value (default 8)
 * @param maxCape - Ending CAPE value (default 44)
 * @returns Array of {cape, withdrawalRate} points
 */
export function generateCapeWithdrawalCurve(
  minCape: number = 8,
  maxCape: number = 44,
): CapeWithdrawalPoint[] {
  const points: CapeWithdrawalPoint[] = [];
  for (let cape = minCape; cape <= maxCape; cape++) {
    points.push({
      cape,
      withdrawalRate: Number(computeErnDynamicWr(cape).toFixed(2)),
    });
  }
  return points;
}

/**
 * Compute the CAPE-implied expected real return.
 *
 * Rule of thumb from ERN Parts 3, 16: expectedRealReturn ≈ 1/CAPE
 * At CAPE 39 → 2.6%, CAPE 20 → 5.0%, CAPE 15 → 6.7%
 *
 * @param cape - Current CAPE ratio
 * @returns Expected real return as percentage
 */
export function computeCapeImpliedReturn(cape: number): number {
  if (cape <= 0) return 0;
  return (1 / cape) * 100;
}

/**
 * Compute conditional failure probability table by CAPE bucket.
 *
 * This is ERN's signature output (Parts 28, 50). For each CAPE bucket and
 * a range of withdrawal rates, compute the percentage of cohorts in that
 * bucket where the fail-safe SWR was below the given WR (i.e. would have failed).
 *
 * @param cohorts - Array of cohort results from historical simulation
 * @param wrRates - Withdrawal rates to test (default: 2.5-5.0% in 0.25% steps)
 * @returns Table of failure rates by bucket and WR
 */
export function computeConditionalFailureTable(
  cohorts: CohortResult[],
  wrRates: number[] = [2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5, 4.75, 5.0],
): ConditionalFailureTable {
  const bucketDefs: { label: string; min: number; max: number }[] = [
    { label: 'All', min: 0, max: Infinity },
    { label: '<15', min: 0, max: 15 },
    { label: '15-20', min: 15, max: 20 },
    { label: '20-25', min: 20, max: 25 },
    { label: '25-30', min: 25, max: 30 },
    { label: '30+', min: 30, max: Infinity },
  ];

  const rows: ConditionalFailureRow[] = bucketDefs.map(({ label, min, max }) => {
    const inBucket = label === 'All'
      ? cohorts
      : cohorts.filter(c => c.cape >= min && c.cape < max);

    const count = inBucket.length;

    const failureRates: Record<string, number> = {};
    for (const wr of wrRates) {
      if (count === 0) {
        failureRates[wr.toFixed(2)] = 0;
      } else {
        const failures = inBucket.filter(c => c.swr < wr).length;
        failureRates[wr.toFixed(2)] = Number(((failures / count) * 100).toFixed(1));
      }
    }

    return { label, count, failureRates };
  });

  return { wrRates, rows };
}

export interface ConditionalFailureRow {
  label: string;
  count: number;
  failureRates: Record<string, number>; // key = WR as string (e.g. "3.50"), value = failure % (0-100)
}

export interface ConditionalFailureTable {
  wrRates: number[];
  rows: ConditionalFailureRow[];
}
