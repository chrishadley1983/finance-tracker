/**
 * Equity glidepath computation per ERN Parts 19, 20.
 *
 * ERN's findings:
 * - Optimal starting equity: 60% (not arbitrary)
 * - Optimal ramp: 10yr (120 months), slope ~0.33%/month
 * - Direction: rising equity (60% → 100%)
 * - CAPE gate: only use glidepath when CAPE > 20; below 20, static 100% equities is best
 */

/** Default glidepath duration in months (10yr per ERN optimal) */
export const DEFAULT_GLIDEPATH_MONTHS = 120;

/** Default starting equity allocation (60% per ERN Parts 19, 20) */
export const DEFAULT_GLIDEPATH_START_EQUITY = 0.60;

/** CAPE threshold below which glidepath is skipped (ERN Parts 19, 20) */
export const CAPE_GLIDEPATH_THRESHOLD = 20;

/**
 * Compute the equity allocation for a given month during glidepath.
 *
 * Passive linear ramp from baseEquity to 100% over glidepathMonths.
 * Formula: min(1, baseEquity + (1 - baseEquity) × min(1, month / glidepathMonths))
 *
 * @param baseEquity - Starting equity allocation (0-1, default 0.60)
 * @param month - Current month (0-based from retirement start)
 * @param enabled - Whether glidepath is active
 * @param glidepathMonths - Duration of the ramp (default 120 = 10yr)
 * @returns Current equity allocation (0-1)
 */
export function computeEquityAllocation(
  baseEquity: number,
  month: number,
  enabled: boolean,
  glidepathMonths: number = DEFAULT_GLIDEPATH_MONTHS,
): number {
  if (!enabled) return baseEquity;
  return Math.min(1, baseEquity + (1 - baseEquity) * Math.min(1, month / glidepathMonths));
}

/**
 * Determine whether to use glidepath based on starting CAPE.
 *
 * ERN Parts 19, 20: glidepaths are only beneficial when CAPE > 20.
 * Below CAPE 20, static 100% equities outperforms.
 *
 * @param startingCape - CAPE ratio at retirement start
 * @param userRequestedGlidepath - Whether user explicitly enabled glidepath
 * @returns Whether glidepath should actually be used
 */
export function shouldUseGlidepath(
  startingCape: number,
  userRequestedGlidepath: boolean,
): boolean {
  if (!userRequestedGlidepath) return false;
  return startingCape >= CAPE_GLIDEPATH_THRESHOLD;
}

/**
 * Get the effective starting equity for the glidepath.
 *
 * If CAPE < 20 and glidepath was requested, returns 1.0 (100% equities)
 * because ERN shows static 100% equities outperforms glidepath in cheap markets.
 *
 * @param baseEquity - User's requested starting equity
 * @param startingCape - CAPE at retirement
 * @param glidepathRequested - Whether user wants glidepath
 * @returns Effective starting equity allocation
 */
export function getEffectiveStartEquity(
  baseEquity: number,
  startingCape: number,
  glidepathRequested: boolean,
): number {
  if (glidepathRequested && startingCape < CAPE_GLIDEPATH_THRESHOLD) {
    return 1.0; // Skip glidepath, go 100% equities in cheap markets
  }
  return baseEquity;
}
