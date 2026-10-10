/**
 * Spending run-rate for the Where-we-are section: trailing-12-month expenses,
 * sign-aware, excluding the plan's one-off/business/reimbursed categories.
 * The arithmetic lives in plan/engine/spend.mjs.
 */
import { ASSUMPTIONS } from './assumptions';
import { computeRunRate as engineRunRate } from '../../plan/engine/spend.mjs';

export interface SpendTxn {
  amount: number; // negative = expense (sign-aware)
  category: {
    name: string;
    is_income: boolean;
    exclude_from_totals: boolean;
  } | null;
}

export interface RunRate {
  trailing12moSpend: number; // net of credits in spend categories
  grossSpend: number;
  creditsNetted: number; // refunds / reimbursements / contributions filed against spend categories
  vsPlanLine: number; // positive = over the plan line
  excludedTotal: number; // what the exclusions removed, net (for the tooltip)
}

export const computeRunRate = (txns: SpendTxn[]): RunRate => engineRunRate(ASSUMPTIONS, txns);
