// @ts-check
/**
 * Scenario runs on top of the ledger (phase 7). Pure; everything comes from
 * `a`, the yields observation and, for the replay, the Shiller monthly series
 * passed in as data. No literals that are planning numbers: scenario knobs are
 * expressed relative to the assumptions (spend line, retirement target, pots).
 *
 * Shiller rows are [realStockReturnBps, realBondReturnBps, cape×10] per month
 * from Jan 1871 (plan/observations/market/shiller-monthly.json).
 */
import { runLedger } from './ledger.mjs';

/** Compound 12 monthly real stock returns from index m. @param {number[][]} rows @param {number} m */
function annualReturnFrom(rows, m) {
  let c = 1;
  for (let i = m; i < m + 12 && i < rows.length; i++) c *= 1 + rows[i][0] / 10000;
  return c - 1;
}

/**
 * The named scenarios Chris asked for (20–21 Sep 2026) plus the flat grid.
 * @param {any} a
 * @param {{ asOf: string, rungs: any[] }} yields
 * @param {{ shiller?: number[][], capeThreshold?: number }} [data]
 */
export function runScenarios(a, yields, data = {}) {
  const planLine = a.spend.planLine, target = a.spend.retirementTarget;
  const hasExt = yields.rungs.some((r) => r.w === 'ext');
  const headline = (/** @type {ReturnType<typeof runLedger>} */ l) => ({ ...l.headline, lifeTax: +l.lifeTax.toFixed(1), G: l.G, spendSchedule: l.spendSchedule, preRetirementDraw: l.headline.preRetirementDraw });

  // Step-down: the plan line while the children are at home, easing after Max finishes education.
  const stepDownYear = a.childBenefit.maxEndsAug + 3; // ~2040: both children independent
  const named = /** @type {Record<string, { title: string, note: string, opts: Parameters<typeof runLedger>[2] }>} */ ({
    baseline: { title: `Planning case: ${target / 1000}k a year for life`, note: 'the accepted plan', opts: {} },
    spendPlanLine: { title: `${planLine / 1000}k a year for life`, note: 'the pre-retirement plan line carried on for life', opts: { spend: planLine } },
    spendPlanLinePlus10: { title: `${(planLine + 10_000) / 1000}k a year for life`, note: 'the 2026 pace carried on for life', opts: { spend: planLine + 10_000 } },
    stepDown: { title: `${(planLine + 10_000) / 1000}k to ${stepDownYear}, then ${(target + 5_000) / 1000}k`, note: `heavy years while the children are at home, then ${(target + 5_000) / 1000}k`, opts: { spendSchedule: [{ fromYear: a.dates.planRetirementYear, spend: planLine + 10_000 }, { fromYear: stepDownYear, spend: target + 5_000 }] } },
    reserveSpent: { title: 'Reserve spent before retirement', note: 'cash buffer and crypto both gone by 2035; otherwise the planning case', opts: { cash: 0, crypto: 0 } },
    chris20kPlanLine: { title: `Chris £20k take-home, spend ${planLine / 1000}k, to retirement`, note: 'household cash flow to 2035 with HB + side income at £20k take-home; shortfalls from the reserve', opts: { preRetirement: { spend: planLine, hbTakeHome: 20_000, cottrell: 3_000, sideIncome: 0 } } },
    chris20kPlus10: { title: `Chris £20k take-home, spend ${(planLine + 10_000) / 1000}k, to retirement`, note: 'as above at the 2026 spending pace', opts: { preRetirement: { spend: planLine + 10_000, hbTakeHome: 20_000, cottrell: 3_000, sideIncome: 0 } } },
    paFillDrawdown: { title: 'Previous drawdown: personal allowance, tax-free cash first', note: 'the planning case with the drawdown assumed before 23 Sep 2026: pensions drawn only to the personal allowance, shortfalls from tax-free cash; compare what is left to the children', opts: { drawdown: 'paFill' } },
    ratchetTo2050: hasExt ? { title: 'Ratchet forward: Accenture pot → 2046–50 rungs', note: 'option only — the pot stays at L&G (decision 3 Sep 2026); taking this would mean transferring it to the SIPP to buy five more rungs at the observed yields; floor extends to 2050', opts: { extension: { budget: a.pots.chrisAccenturePension, fromYear: a.ladder.lastYear + 1, toYear: a.ladder.lastYear + 5, source: 'acn' } } } : /** @type {any} */ (null),
  });
  /** @type {Record<string, any>} */
  const scenarios = {};
  for (const [id, s] of Object.entries(named)) {
    if (!s) continue;
    const cases = [0, a.returns.realEquity.planning, a.returns.realEquity.better].map((G) => headline(runLedger(a, yields, { ...s.opts, G })));
    scenarios[id] = { id, title: s.title, note: s.note, cases, extension: id === 'ratchetTo2050' ? runLedger(a, yields, s.opts).extension : null };
  }

  // Flat grid: return × spend.
  const returns = [0, 0.01, a.returns.realEquity.planning, 0.03, a.returns.realEquity.better];
  const spends = [target, planLine, planLine + 10_000];
  const grid = spends.map((spend) => ({ spend, byReturn: returns.map((G) => headline(runLedger(a, yields, { spend, G }))) }));

  // Historical replay: every start month in the Shiller record with a full path, equity returns
  // year by year from that start; gilts stay at their locked yields (they are real linkers).
  let replay = null;
  if (data.shiller && data.shiller.length) {
    const rows = data.shiller;
    const years = a.dates.simulationEndYear - 2026;
    const need = years * 12;
    // 25 rather than 30: with full-length paths only 1929 clears 30 (2 starts); 25 adds 1901 and 1928–30 (14 starts).
    const capeThreshold = data.capeThreshold ?? 25;
    /** @type {Array<{ startIndex: number, cape: number, atEnd: number, failYear: number | null }>} */
    const paths = [];
    for (let m = 0; m + need <= rows.length; m++) {
      const gPath = Array.from({ length: years }, (_, i) => annualReturnFrom(rows, m + i * 12));
      const l = runLedger(a, yields, { gPath });
      paths.push({ startIndex: m, cape: rows[m][2] / 10, atEnd: l.headline.atEnd ?? 0, failYear: l.headline.firstCashNegative });
    }
    const stats = (/** @type {typeof paths} */ ps) => {
      const ends = ps.map((x) => x.atEnd).sort((x, y) => x - y);
      const q = (/** @type {number} */ f) => ends[Math.min(ends.length - 1, Math.floor(f * ends.length))];
      return { starts: ps.length, failRate: ps.length ? ps.filter((x) => x.failYear !== null).length / ps.length : 0, p5: q(0.05), p50: q(0.5), p95: q(0.95), worst: ends[0], best: ends[ends.length - 1] };
    };
    const highCape = paths.filter((x) => x.cape >= capeThreshold);
    replay = { yearsPerPath: years, all: stats(paths), highCape: { threshold: capeThreshold, ...stats(highCape) }, currentCape: rows[rows.length - 1][2] / 10, firstStartYear: 1871, lastStartYear: 1871 + Math.floor((rows.length - need) / 12) };
  }
  return { asOfYields: yields.asOf, stepDownYear, scenarios, grid, returns, spends, replay };
}
