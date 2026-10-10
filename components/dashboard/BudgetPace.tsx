'use client';

import Link from 'next/link';
import { PaceBar } from '@/components/ui/PaceBar';
import { EmptyState } from '@/components/ui/Notice';
import { formatGBP } from '@/lib/format';
import type { BudgetComparison } from '@/lib/types/budget';

interface BudgetPaceProps {
  rows: BudgetComparison[];
  /** Fraction of the month gone (current month only); draws the even-pace tick. */
  pace?: number;
  budgetsHref: string;
  /** Open the detail panel for a line. */
  onOpen?: (c: BudgetComparison) => void;
}

/** Expense categories with a budget this month, the biggest plans first. */
export function budgetRows(comparisons: BudgetComparison[]): BudgetComparison[] {
  return comparisons
    .filter((c) => !c.isIncome && Math.abs(c.budgetAmount) > 0)
    .sort((a, b) => Math.abs(b.budgetAmount) - Math.abs(a.budgetAmount));
}

/** Names of categories over budget, biggest overspend first. */
export function overBudget(comparisons: BudgetComparison[]): string[] {
  return budgetRows(comparisons)
    .filter((c) => c.actualAmount > Math.abs(c.budgetAmount))
    .sort((a, b) => b.actualAmount - Math.abs(b.budgetAmount) - (a.actualAmount - Math.abs(a.budgetAmount)))
    .map((c) => c.categoryName);
}

export function BudgetPace({ rows, pace, budgetsHref, onOpen }: BudgetPaceProps) {
  const budgeted = budgetRows(rows);

  if (budgeted.length === 0) {
    return (
      <EmptyState
        title="No budgets for this month"
        action={
          <Link href={budgetsHref} className="text-sm font-medium text-accent hover:underline">
            Set budgets
          </Link>
        }
      >
        Set a monthly plan per category and this shows how each one is pacing.
      </EmptyState>
    );
  }

  return (
    <div>
      <ul className="grid gap-3.5">
        {budgeted.map((c) => {
          const budget = Math.abs(c.budgetAmount);
          const spent = Math.max(c.actualAmount, 0);
          const over = spent - budget;
          return (
            <li key={c.categoryId} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                {onOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpen(c)}
                    className="min-w-0 truncate text-left text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                    title={`${c.categoryName}: details`}
                  >
                    {c.categoryName}
                  </button>
                ) : (
                  <span className="min-w-0 truncate text-ink">{c.categoryName}</span>
                )}
                <span className="shrink-0 text-ink-3">
                  {over > 0 && <span className="fig mr-2 text-bad">{formatGBP(over)} over</span>}
                  <span className="fig text-ink">{formatGBP(spent)}</span>
                  <span className="fig"> / {formatGBP(budget)}</span>
                </span>
              </div>
              <PaceBar spent={spent} budget={budget} pace={pace} label={`${c.categoryName}: ${formatGBP(spent)} of ${formatGBP(budget)}`} />
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
        {pace !== undefined
          ? 'The first tick marks an even pace for today; the second marks the budget. Amber means well ahead of pace; red means over budget.'
          : 'The tick marks the budget; red means over budget.'}
      </p>
    </div>
  );
}
