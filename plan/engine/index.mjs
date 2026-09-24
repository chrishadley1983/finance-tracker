// @ts-check
/**
 * The plan engine's single entry point: runPlan(inputs) → outputs.
 * Deterministic and pure: the same inputs give byte-identical outputs. No
 * filesystem, no network, no dates read from the clock (pass `today`).
 *
 * inputs = {
 *   assumptions: the `values` object from plan/inputs/assumptions.mjs,
 *   giltPrices?:  { asOf, gilts[] }                    (plan/observations/gilt-prices/*.json or live)
 *   giltYields?:  { asOf, rungs[] }                    (plan/observations/gilt-yields/*.json)
 *   payslip?:     latest payslip observation            (plan/observations/payslips/*.json)
 *   shiller?:     monthly [stockBps, bondBps, cape×10] rows (plan/observations/market/shiller-monthly.json) for the replay
 *   today?:       'YYYY-MM-DD'
 * }
 */
import { pivotProgramme, currentRetune, avcRecipeFromYtd, takeHomeNominal, pivotYear } from './pivot.mjs';
import { buildLadder, couponSchedule, splitByHolder } from './ladder.mjs';
import { runLedger } from './ledger.mjs';
import { defaultOutlook, potsAtExit, sustainableSpend, drawdownSim } from './outlook.mjs';
import { runScenarios } from './scenarios.mjs';

export const ENGINE_VERSION = '2026-09-23.real-terms';

/**
 * @param {{ assumptions: any, giltPrices?: { asOf: string, gilts: any[] }, giltYields?: { asOf: string, rungs: any[] }, payslip?: any, shiller?: number[][], today?: string }} inputs
 */
export function runPlan(inputs) {
  const a = inputs.assumptions;
  const today = inputs.today ? new Date(inputs.today + 'T00:00:00Z') : null;
  const programme = pivotProgramme(a, a.hicbc.lowerThreshold);
  const operating = pivotProgramme(a, a.hicbc.operatingTarget);
  const retune = today ? currentRetune(a, a.hicbc.operatingTarget, today) : null;
  const ladder = inputs.giltPrices ? buildLadder(a, inputs.giltPrices.gilts) : null;
  // The two wrappers sized on their own budgets: ISA rungs must cover the years before Chris's pension opens.
  const ladderIsa = inputs.giltPrices ? buildLadder(a, inputs.giltPrices.gilts, { firstYear: a.ladder.firstYear, lastYear: a.dates.chrisPensionAccessYear, budgetReal: a.ladder.isaBudgetReal }) : null;
  const ladderSipp = inputs.giltPrices ? buildLadder(a, inputs.giltPrices.gilts, { firstYear: a.dates.chrisPensionAccessYear + 1, lastYear: a.ladder.lastYear, budgetReal: a.ladder.sippBudgetReal }) : null;
  const gy = inputs.giltYields;
  const ledger = gy ? runLedger(a, gy) : null;
  const ledgerFlat = gy ? [0, a.returns.realEquity.planning, a.returns.realEquity.better].map((G) => { const l = runLedger(a, gy, { G }); return { G, ...l.headline, lifeTax: l.lifeTax }; }) : null;
  const scenarios = gy ? runScenarios(a, gy, { shiller: inputs.shiller }) : null;
  const outlookOpts = defaultOutlook(a);
  const outlook = { options: outlookOpts, pots: potsAtExit(a, outlookOpts), sustainableSpend: sustainableSpend(a, outlookOpts), drawdown: drawdownSim(a, outlookOpts) };
  return {
    engineVersion: ENGINE_VERSION,
    inputsSummary: { assumptionsPreparedOn: inputs.assumptions.__preparedOn ?? null, giltPricesAsOf: inputs.giltPrices?.asOf ?? null, giltYieldsAsOf: inputs.giltYields?.asOf ?? null, payslipMonth: inputs.payslip ? `${inputs.payslip.taxYear} M${inputs.payslip.taxMonth}` : null, today: inputs.today ?? null },
    pivot: {
      modelledTo: a.hicbc.lowerThreshold, operatedTo: a.hicbc.operatingTarget, programme, operating, retune,
      takeHomeYear1AtLine: takeHomeNominal(a, 0, pivotYear(a, 0, a.hicbc.lowerThreshold).extraSacrifice),
      avcRecipe: inputs.payslip ? avcRecipeFromYtd(a, inputs.payslip) : null,
    },
    ladder: ladder ? { ...ladder, coupons: couponSchedule(ladder, 2027), pricesAsOf: inputs.giltPrices?.asOf, isa: ladderIsa ? { ...ladderIsa, coupons: couponSchedule(ladderIsa, 2027), byHolder: splitByHolder(ladderIsa, a.pots.chrisIiIsa, ['chris', 'abby']) } : null, sipp: ladderSipp ? { ...ladderSipp, coupons: couponSchedule(ladderSipp, 2027) } : null } : null,
    ledger, ledgerFlat, scenarios, outlook,
    knownLimitations: inputs.assumptions.__knownLimitations ?? [],
  };
}
