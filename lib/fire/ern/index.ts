// ERN-grade SWR Engine — barrel exports

// Data accessors
export {
  CAPE_START_INDEX,
  getDataLength,
  getMonthlyReturn,
  getCape,
  getStockReturn,
  getBondReturn,
  getWeightedReturn,
  getRawData,
} from './data';

// Core SWR computation
export { computeSWR } from './swr';

// Historical simulation
export { runExhaustiveHistoricalSim } from './historical-sim';

// CAPE analysis
export {
  computeErnDynamicWr,
  generateCapeWithdrawalCurve,
  computeCapeImpliedReturn,
  computeConditionalFailureTable,
} from './cape-analysis';
export type {
  ConditionalFailureRow,
  ConditionalFailureTable,
} from './cape-analysis';

// Monte Carlo
export { runMonteCarlo, createMcConfigFromErn } from './monte-carlo';

// Accumulation
export { projectPortfolioAtRetirement } from './accumulation';

// Spending rules (Phase 3)
export {
  applySpendingDecline,
  applyPensionOffset,
  applyGuardrail,
  computeCapeBasedWithdrawal,
  computePensionPV,
  computePart54AdjustedWithdrawal,
} from './spending-rules';

// Glidepath (Phase 3)
export {
  computeEquityAllocation,
  shouldUseGlidepath,
  getEffectiveStartEquity,
  DEFAULT_GLIDEPATH_MONTHS,
  DEFAULT_GLIDEPATH_START_EQUITY,
  CAPE_GLIDEPATH_THRESHOLD,
} from './glidepath';

// UK Tax (Phase 4)
export {
  computeIncomeTax,
  computeNetIncome,
  computeEffectiveTaxRate,
  computeMarginalRate,
  computeCGT,
  computeDividendTax,
  computeTFLS,
  computeUFPLSTax,
  getPersonalAllowance,
  realPersonalAllowance,
  computeFiscalDragCost,
  PERSONAL_ALLOWANCE,
  PA_TAPER_THRESHOLD,
  CGT_ALLOWANCE,
  LUMP_SUM_ALLOWANCE,
  TFLS_FRACTION,
} from './uk-tax';

// UK Drawdown Optimiser (Phase 4)
export {
  computeOptimalDrawdown,
  projectDrawdown,
  suggestCGTHarvest,
} from './uk-drawdown';
export type {
  WrapperBalances,
  DrawdownResult,
  DrawdownConfig,
  YearlyDrawdown,
  DrawdownProjectionConfig,
} from './uk-drawdown';

// Live CAPE (Phase 6)
export { getLatestCape, getDataVintage } from './live-cape';

// Types
export type {
  MonthlyReturn,
  ErnSimConfig,
  CohortResult,
  CapeBucket,
  ErnHistoricalResults,
  McConfig,
  McResults,
  CapeWithdrawalPoint,
  ErnDashboardResults,
  FireTakeaway,
  FireTakeawayTag,
} from './types';

// Zod schemas
export {
  ernSimConfigSchema,
  ernSimulateRequestSchema,
  fireTakeawaySchema,
} from './types';
