import { getDataLength, getRawData } from './data';
import type { MonthlyReturn } from './types';

/** Monthly fee drag: 0.05% p.a. = 0.0005/12 per month */
const FEE_MONTHLY = 0.0005 / 12;

/**
 * Compute the closed-form fail-safe SWR for a single cohort.
 *
 * ERN Part 8 formula:
 *   w = (CR[T] - F) / (CR[T] × Σ(1/CR[j]))
 * where CR[T] = cumulative portfolio return at horizon T,
 * F = final value target as fraction of initial,
 * Σ(1/CR[j]) = sum of inverse cumulative returns.
 *
 * Returns annualised SWR as a percentage (e.g. 3.5 for 3.5%).
 * Returns null if the cohort doesn't have enough data.
 * Returns 0 if the SWR is negative (portfolio couldn't survive).
 *
 * @param startIndex - Starting month index in the Shiller dataset
 * @param equityPct - Equity allocation as decimal (0-1, e.g. 0.80)
 * @param horizonMonths - Number of months to simulate
 * @param preserveFraction - Capital preservation target (0 = depletion, 0.5 = 50% preserved)
 * @param glidepath - Whether to ramp equity to 100% over the glidepath duration
 * @param glidepathMonths - Glidepath ramp duration in months (default 120 = 10yr, ERN optimal)
 * @param data - Raw data array (injected for testability, defaults to Shiller dataset)
 * @param includeFees - Whether to subtract fee drag (default true, 0.05% p.a.)
 */
export function computeSWR(
  startIndex: number,
  equityPct: number,
  horizonMonths: number,
  preserveFraction: number,
  glidepath: boolean,
  glidepathMonths: number = 120,
  data?: MonthlyReturn[],
  includeFees: boolean = true,
): number | null {
  const D = data ?? getRawData();
  const len = data ? data.length : getDataLength();

  if (startIndex + horizonMonths > len) return null;

  const feeMo = includeFees ? FEE_MONTHLY : 0;
  let cr = 1;
  let sinv = 1;

  for (let t = 0; t < horizonMonths; t++) {
    const m = startIndex + t;
    let eq = equityPct;

    if (glidepath) {
      eq = Math.min(1, equityPct + (1 - equityPct) * Math.min(1, t / glidepathMonths));
    }

    const r = eq * D[m][0] / 10000 + (1 - eq) * D[m][1] / 10000 - feeMo;
    cr *= (1 + r);

    if (t < horizonMonths - 1) {
      sinv += 1 / cr;
    }
  }

  if (cr <= 0 || sinv <= 0) return null;

  const w = (cr - preserveFraction) / (cr * sinv);
  return w > 0 ? w * 12 * 100 : 0;
}
