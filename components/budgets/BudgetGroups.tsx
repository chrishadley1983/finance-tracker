'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { PaceBar } from '@/components/ui/PaceBar';
import { formatGBP } from '@/lib/format';
import { remainingWords } from '@/lib/budgets/period';
import type { BudgetComparison, BudgetGroupComparison } from '@/lib/types/budget';
import { BudgetAmount } from './BudgetAmount';

interface BudgetGroupsProps {
  groups: BudgetGroupComparison[];
  /** Fraction of the period elapsed, for the pace tick (current period only). */
  pace?: number;
  /** "October" / "2026": used in labels. */
  periodWords: string;
  /** Month view: edit in place. */
  onSaveAmount?: (category: BudgetComparison, amount: number) => void;
  /** Year view: open the 12-month editor. */
  onOpenYear?: (category: BudgetComparison, groupName: string) => void;
}

const isEmpty = (c: BudgetComparison) => c.budgetAmount === 0 && c.actualAmount === 0;

const TONE = { muted: 'text-ink-3', bad: 'text-bad', in: 'text-in' } as const;

function CategoryRow({
  c,
  groupName,
  pace,
  periodWords,
  onSaveAmount,
  onOpenYear,
}: { c: BudgetComparison; groupName: string } & Omit<BudgetGroupsProps, 'groups'>) {
  const words = remainingWords(c, (n) => formatGBP(n));
  return (
    <li
      data-testid="budget-row"
      className="grid grid-cols-[minmax(0,1fr)_8.75rem] items-center gap-x-4 gap-y-1.5 border-t border-line-2 py-2.5 first:border-t-0 md:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)_10rem_9.5rem]"
    >
      <span className="col-start-1 row-start-1 min-w-0 truncate text-[13.5px] text-ink" title={c.categoryName}>
        {c.categoryName}
      </span>
      <div className="col-start-1 row-start-2 md:col-start-2 md:row-start-1">
        <PaceBar
          spent={c.actualAmount}
          budget={c.budgetAmount}
          pace={c.isIncome ? undefined : pace}
          fixed={c.isIncome || (c.budgetAmount > 0 && c.actualAmount === c.budgetAmount)}
          label={`${c.categoryName}: ${formatGBP(c.actualAmount)} of ${formatGBP(c.budgetAmount)}`}
        />
      </div>
      <span className="col-start-2 row-start-1 whitespace-nowrap text-right text-[13px] text-ink-2 md:col-start-3">
        <span className="fig">{formatGBP(c.actualAmount)}</span>
        <span className="text-ink-3"> / </span>
        <BudgetAmount
          amount={c.budgetAmount}
          name={c.categoryName}
          periodWords={periodWords}
          onSave={onSaveAmount ? (n) => onSaveAmount(c, n) : undefined}
          onOpen={onOpenYear ? () => onOpenYear(c, groupName) : undefined}
        />
      </span>
      <span className={`col-start-2 row-start-2 whitespace-nowrap text-right text-[12.5px] md:col-start-4 md:row-start-1 ${TONE[words.tone]}`}>
        {words.text}
      </span>
    </li>
  );
}

/** Budget rows grouped by category group: spending first, then income. */
export function BudgetGroups({ groups, pace, periodWords, onSaveAmount, onOpenYear }: BudgetGroupsProps) {
  const [showEmpty, setShowEmpty] = useState(false);
  const emptyCount = groups.reduce((n, g) => n + g.categories.filter(isEmpty).length, 0);
  const ordered = [...groups.filter((g) => !g.isIncome), ...groups.filter((g) => g.isIncome)];

  return (
    <div className="grid gap-7">
      {ordered.map((g) => {
        const rows = showEmpty ? g.categories : g.categories.filter((c) => !isEmpty(c));
        if (rows.length === 0) return null;
        return (
          <Panel
            key={g.groupName}
            title={g.isIncome && !/income/i.test(g.groupName) ? `${g.groupName} (income)` : g.groupName}
            action={
              <span className="whitespace-nowrap">
                <span className="fig text-ink-2">{formatGBP(g.totals.actual)}</span>
                <span> / </span>
                <span className="fig">{formatGBP(g.totals.budget)}</span>
              </span>
            }
          >
            <ul role="list">
              {rows.map((c) => (
                <CategoryRow
                  key={c.categoryId}
                  c={c}
                  groupName={g.groupName}
                  pace={pace}
                  periodWords={periodWords}
                  onSaveAmount={onSaveAmount}
                  onOpenYear={onOpenYear}
                />
              ))}
            </ul>
          </Panel>
        );
      })}
      {emptyCount > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowEmpty((v) => !v)}
            aria-expanded={showEmpty}
            className="rounded-md px-1 py-1 text-[13px] text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {showEmpty
              ? 'Hide categories with no budget or spending'
              : `Show ${emptyCount} ${emptyCount === 1 ? 'category' : 'categories'} with no budget or spending`}
          </button>
        </div>
      )}
    </div>
  );
}
