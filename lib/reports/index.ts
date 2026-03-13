// Monthly report — barrel exports

export { aggregateMonthlyReport, saveMonthlyReport } from './aggregate';
export { generateTakeaways } from './takeaways';
export { generateMonthlyReportHtml } from './monthly-html';
export type {
  MonthlyReportData,
  WealthBreakdownItem,
  BudgetComparisonItem,
  MonthlyTrendItem,
  FireScenarioProgress,
  PriorMonthData,
  Takeaway,
  TakeawayTag,
} from './types';
