import { getDataLength, getCape, CAPE_START_INDEX } from './data';
import { computeSWR } from './swr';
import type { ErnSimConfig, CohortResult, ErnHistoricalResults } from './types';

/**
 * Run exhaustive historical simulation across all valid cohorts.
 *
 * Uses EVERY cohort from CAPE_START_INDEX (not every 3rd) per Phase A findings.
 * Each cohort is a potential retirement start date. For each, we compute the
 * exact fail-safe SWR using ERN's closed-form formula.
 *
 * @param config - ERN simulation configuration
 * @returns Full historical results with cohorts, buckets, and aggregate stats
 */
export function runExhaustiveHistoricalSim(config: ErnSimConfig): ErnHistoricalResults {
  const {
    equityAllocation,
    horizonYears,
    preserveFraction,
    glidepathEnabled,
  } = config;

  const horizonMonths = horizonYears * 12;
  const dataLength = getDataLength();
  const lastValidStart = dataLength - horizonMonths;

  const cohorts: CohortResult[] = [];

  // Use every cohort from CAPE_START_INDEX (Phase A: not every 3rd)
  for (let i = CAPE_START_INDEX; i <= lastValidStart; i++) {
    const cape = getCape(i);
    if (cape < 2) continue; // Skip invalid CAPE values

    const swr = computeSWR(
      i,
      equityAllocation,
      horizonMonths,
      preserveFraction,
      glidepathEnabled,
    );

    if (swr === null) continue;

    cohorts.push({ startIndex: i, cape, swr });
  }

  // Sort SWR values for statistics
  const allSwrs = cohorts.map(c => c.swr).sort((a, b) => a - b);
  const failSafeSwr = allSwrs[0] ?? 0;
  const medianSwr = allSwrs[Math.floor(allSwrs.length / 2)] ?? 0;

  // High-CAPE cohorts (CAPE >= 30)
  const highCapeCohorts = cohorts.filter(c => c.cape >= 30);
  const highCapeSwrs = highCapeCohorts.map(c => c.swr).sort((a, b) => a - b);
  const highCapeFailSafe = highCapeSwrs[0] ?? 0;
  const highCapeMedian = highCapeSwrs[Math.floor(highCapeSwrs.length / 2)] ?? 0;

  // Compute CAPE buckets
  const capeBuckets = computeCapeBucketsFromCohorts(cohorts);

  return {
    cohorts,
    capeBuckets,
    failSafeSwr,
    medianSwr,
    highCapeCohorts,
    highCapeFailSafe,
    highCapeMedian,
    totalCohorts: cohorts.length,
  };
}

/**
 * Compute CAPE bucket statistics from cohort results.
 */
function computeCapeBucketsFromCohorts(cohorts: CohortResult[]) {
  const bucketDefs: { label: string; min: number; max: number }[] = [
    { label: '<15', min: 0, max: 15 },
    { label: '15-20', min: 15, max: 20 },
    { label: '20-25', min: 20, max: 25 },
    { label: '25-30', min: 25, max: 30 },
    { label: '30+', min: 30, max: Infinity },
  ];

  return bucketDefs.map(({ label, min, max }) => {
    const inBucket = cohorts
      .filter(c => c.cape >= min && c.cape < max)
      .map(c => c.swr)
      .sort((a, b) => a - b);

    return {
      label,
      count: inBucket.length,
      failSafe: inBucket[0] ?? 0,
      median: inBucket[Math.floor(inBucket.length / 2)] ?? 0,
    };
  });
}
