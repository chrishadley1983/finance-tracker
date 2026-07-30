/**
 * Spending run-rate for the Where-we-are section: trailing-12-month expenses,
 * sign-aware, excluding the plan's one-off/business/reimbursed categories.
 */

import { SPEND } from './constants';

export interface SpendTxn {
  amount: number; // negative = expense (sign-aware)
  category: {
    name: string;
    is_income: boolean;
    exclude_from_totals: boolean;
  } | null;
}

export interface RunRate {
  trailing12moSpend: number;
  vsPlanLine: number; // positive = over the £69.5k line
  excludedTotal: number; // what the exclusions removed (for the tooltip)
}

export function computeRunRate(txns: SpendTxn[]): RunRate {
  let spend = 0;
  let excluded = 0;
  for (const t of txns) {
    const c = t.category;
    if (!c || c.exclude_from_totals || c.is_income) continue;
    if (t.amount >= 0) continue;
    const a = Math.abs(t.amount);
    if (SPEND.excludedCategories.includes(c.name)) {
      excluded += a;
    } else {
      spend += a;
    }
  }
  return {
    trailing12moSpend: spend,
    vsPlanLine: spend - SPEND.planLine,
    excludedTotal: excluded,
  };
}
