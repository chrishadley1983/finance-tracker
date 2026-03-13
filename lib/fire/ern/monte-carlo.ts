import { getDataLength, getRawData } from './data';
import type { MonthlyReturn, McConfig, McResults, WrapperBalances } from './types';
import { computeOptimalDrawdown } from './uk-drawdown';
import { applySpendingDecline, applyPensionOffset, applyGuardrail } from './spending-rules';

/** Monthly fee drag: 0.05% p.a. */
const FEE_MONTHLY = 0.0005 / 12;

/**
 * Deterministic PRNG (Park-Miller LCG).
 * sd = (sd * 16807) % 2147483647
 * Returns value in (0, 1).
 */
function createPrng(seed: number) {
  let sd = seed;
  return (): number => {
    sd = (sd * 16807) % 2147483647;
    return sd / 2147483647;
  };
}

/**
 * Run Monte Carlo simulation using monthly block-bootstrap.
 *
 * Draws contiguous 60-month blocks from historical data to preserve
 * autocorrelation in returns. Uses deterministic PRNG for reproducibility.
 *
 * @param config - Monte Carlo configuration
 * @returns Results with paths, survival rate, and percentile data
 */
export function runMonteCarlo(config: McConfig): McResults {
  const {
    portfolio,
    annualSpend,
    equityAllocation,
    horizonMonths,
    glidepathEnabled,
    statePensionMonthly,
    pensionStartMonth,
    gogoEnabled,
    guardrailEnabled,
    paths: numPaths,
    seed,
    retirementMonth = 0,
    monthlySavings = 0,
    partialEarningsMonthly = 0,
    partialEarningsEndMonth = 0,
  } = config;

  const D = getRawData();
  const blockSize = 60;
  const maxBlockStart = D.length - blockSize;
  const rng = createPrng(seed);
  const monthlySpend = annualSpend / 12;

  // Glidepath duration: 10yr (120mo) per Phase A ERN optimal
  const glidepathMonths = 120;

  // Tax-aware drawdown setup
  const hasWrappers = !!config.wrapperBalances;
  const spaAge = config.statePensionStartAge ?? 67;
  const spaAnnual = config.statePensionAnnual ?? (statePensionMonthly * 12);

  const allPaths: number[][] = [];

  for (let s = 0; s < numPaths; s++) {
    let p = portfolio;
    let peak = portfolio;
    const yearlyValues: number[] = [];

    // Per-path wrapper tracking (clone so each path is independent)
    let wrappers: WrapperBalances | null = hasWrappers
      ? { ...config.wrapperBalances! }
      : null;
    let lsaUsed = 0;

    let blockOffset = Math.floor(rng() * maxBlockStart);

    for (let t = 0; t < horizonMonths; t++) {
      // New block every 60 months
      if (t % blockSize === 0) {
        blockOffset = Math.floor(rng() * maxBlockStart);
      }

      const mi = blockOffset + (t % blockSize);

      // Equity allocation (with optional glidepath — starts at retirement)
      let eq = equityAllocation;
      if (glidepathEnabled && t >= retirementMonth) {
        const drawdownMonth = t - retirementMonth;
        eq = Math.min(1, equityAllocation + (1 - equityAllocation) * Math.min(1, drawdownMonth / glidepathMonths));
      }

      // Monthly return with fee drag
      const r = eq * D[mi][0] / 10000 + (1 - eq) * D[mi][1] / 10000 - FEE_MONTHLY;

      if (t < retirementMonth) {
        // === ACCUMULATION PHASE: add savings, no withdrawal ===
        p = (p + monthlySavings) * (1 + r);
        // Grow wrapper balances proportionally during accumulation
        if (wrappers) {
          const total = wrappers.isa + wrappers.sipp + wrappers.gia + wrappers.cash;
          if (total > 0) {
            wrappers = {
              isa: wrappers.isa * (1 + r) + monthlySavings * (wrappers.isa / total),
              sipp: wrappers.sipp * (1 + r) + monthlySavings * (wrappers.sipp / total),
              gia: wrappers.gia * (1 + r) + monthlySavings * (wrappers.gia / total),
              cash: wrappers.cash, // Cash earns no real return
            };
          }
        }
      } else {
        // === DRAWDOWN PHASE ===
        const drawdownMonth = t - retirementMonth;
        const age = (config.currentAge ?? 42) + drawdownMonth / 12;

        // Start with base monthly spend
        let w = monthlySpend;

        // Apply spending decline (go-go/slow-go/no-go)
        if (gogoEnabled) {
          w = applySpendingDecline(w, age);
        }

        // Partial earnings offset
        if (partialEarningsMonthly > 0 && t < partialEarningsEndMonth) {
          w = Math.max(0, w - partialEarningsMonthly);
        }

        // Pension offset: reduce withdrawal after pension starts
        w = applyPensionOffset(w, statePensionMonthly, drawdownMonth, pensionStartMonth - retirementMonth);

        // Guardrail: cut spending if portfolio drops
        if (guardrailEnabled) {
          w = applyGuardrail(w, p, peak);
        }

        peak = Math.max(peak, p);

        if (wrappers) {
          // TAX-AWARE DRAWDOWN: use optimal wrapper draw order
          const retirementAge = (config.currentAge ?? 42) + retirementMonth / 12;
          const ageNow = retirementAge + drawdownMonth / 12;
          const receivingStatePension = ageNow >= spaAge;
          const canAccessSipp = ageNow >= 57;
          const annualW = w * 12; // Annualise for tax calc

          const result = computeOptimalDrawdown({
            annualSpend: annualW,
            balances: wrappers,
            statePensionAnnual: spaAnnual,
            receivingStatePension,
            lsaUsed,
            giaGainFraction: Math.min(0.9, 0.5 + (drawdownMonth / 12) * 0.01),
            useUFPLS: false,
            canAccessSipp,
          });

          lsaUsed += result.fromSippTaxFree;

          // Monthly gross draw = net spending + tax / 12
          const grossMonthly = (result.fromIsa + result.fromSipp + result.fromGia + result.fromCash) / 12;

          // Update wrapper balances (apply monthly return to remaining)
          wrappers = {
            isa: Math.max(0, (wrappers.isa - result.fromIsa / 12) * (1 + r)),
            sipp: Math.max(0, (wrappers.sipp - result.fromSipp / 12) * (1 + r)),
            gia: Math.max(0, (wrappers.gia - result.fromGia / 12) * (1 + r)),
            cash: Math.max(0, wrappers.cash - result.fromCash / 12),
          };

          p = Math.max(0, wrappers.isa + wrappers.sipp + wrappers.gia + wrappers.cash);
        } else {
          // SIMPLE DRAWDOWN: no tax modelling (backward-compatible)
          p = Math.max(0, (p - w) * (1 + r));
        }
      }

      // Record yearly snapshot
      if (t % 12 === 0) {
        yearlyValues.push(p);
      }
    }

    allPaths.push(yearlyValues);
  }

  // Compute survival rate
  const survivorThreshold = 1000;
  const survivors = allPaths.filter(path => {
    const finalValue = path[path.length - 1] ?? 0;
    return finalValue > survivorThreshold;
  });
  const survivalRate = Math.round((survivors.length / allPaths.length) * 100);

  // Find worst path
  let worstPathIndex = 0;
  let worstFinal = Infinity;
  allPaths.forEach((path, i) => {
    const final = path[path.length - 1] ?? 0;
    if (final < worstFinal) {
      worstFinal = final;
      worstPathIndex = i;
    }
  });

  // Compute percentiles by year
  const numYears = allPaths[0]?.length ?? 0;
  const p5: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];

  for (let y = 0; y < numYears; y++) {
    const values = allPaths.map(path => path[y] ?? 0).sort((a, b) => a - b);
    p5.push(Math.round(percentile(values, 5)));
    p25.push(Math.round(percentile(values, 25)));
    p50.push(Math.round(percentile(values, 50)));
    p75.push(Math.round(percentile(values, 75)));
    p95.push(Math.round(percentile(values, 95)));
  }

  return {
    paths: allPaths,
    survivalRate,
    percentiles: { p5, p25, p50, p75, p95 },
    worstPathIndex,
    worstPath: allPaths[worstPathIndex] ?? [],
  };
}

/**
 * Compute a percentile from a sorted array.
 */
function percentile(sorted: number[], p: number): number {
  const index = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(index, sorted.length - 1)] ?? 0;
}

/**
 * Create a McConfig from an ErnSimConfig (convenience helper).
 */
export function createMcConfigFromErn(config: {
  portfolio: number;
  annualSpend: number;
  equityAllocation: number;
  horizonYears: number;
  glidepathEnabled: boolean;
  statePensionAnnual: number;
  statePensionStartAge: number;
  currentAge: number;
  gogoEnabled: boolean;
  guardrailEnabled: boolean;
  mcPaths: number;
  retirementAge?: number;
  annualSavings?: number;
  partialEarningsAnnual?: number;
  partialEarningsYears?: number;
  wrapperBalances?: { isa: number; sipp: number; gia: number; cash: number };
}): McConfig {
  const retirementAge = config.retirementAge ?? config.currentAge;
  const yearsToRetirement = Math.max(0, retirementAge - config.currentAge);
  const retirementMonth = yearsToRetirement * 12;

  const partialEarningsYears = config.partialEarningsYears ?? 0;
  const partialEarningsEndMonth = retirementMonth + partialEarningsYears * 12;

  return {
    portfolio: config.portfolio,
    annualSpend: config.annualSpend,
    equityAllocation: config.equityAllocation,
    horizonMonths: config.horizonYears * 12,
    glidepathEnabled: config.glidepathEnabled,
    statePensionMonthly: config.statePensionAnnual / 12,
    pensionStartMonth: (config.statePensionStartAge - config.currentAge) * 12,
    gogoEnabled: config.gogoEnabled,
    guardrailEnabled: config.guardrailEnabled,
    paths: config.mcPaths,
    seed: 42,
    currentAge: config.currentAge,
    retirementMonth,
    monthlySavings: (config.annualSavings ?? 0) / 12,
    partialEarningsMonthly: (config.partialEarningsAnnual ?? 0) / 12,
    partialEarningsEndMonth,
    wrapperBalances: config.wrapperBalances,
    statePensionAnnual: config.statePensionAnnual,
    statePensionStartAge: config.statePensionStartAge,
  };
}
