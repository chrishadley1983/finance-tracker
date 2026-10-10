'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MonthSwitcher } from '@/components/ui/MonthSwitcher';
import { monthKey, periodLabel, stepPeriod, switchView, currentMonthPeriod, type BudgetPeriod } from '@/lib/budgets/period';

interface PeriodNavProps {
  period: BudgetPeriod;
  onChange: (next: BudgetPeriod) => void;
  now?: Date;
}

/** Previous / next period, the period's name, a way back to today, and Month / Year. */
export function PeriodNav({ period, onChange, now = new Date() }: PeriodNavProps) {
  const unit = period.view === 'year' ? 'year' : 'month';
  const today = currentMonthPeriod(now);
  const isToday =
    period.view === 'year' ? period.year === today.year : period.year === today.year && period.month === today.month;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="-ml-2 flex items-center gap-1">
        {period.view === 'month' ? (
          <MonthSwitcher
            value={monthKey(period.year, period.month)}
            min="2000-01"
            max="2100-12"
            onChange={(key) => {
              const [year, month] = key.split('-').map(Number);
              onChange({ view: 'month', year, month });
            }}
          />
        ) : (
          <>
            <Button variant="ghost" size="sm" aria-label={`Previous ${unit}`} onClick={() => onChange(stepPeriod(period, -1))} className="!px-1.5">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <h2 className="min-w-[8.5rem] text-center text-lg font-semibold tracking-tight text-ink" aria-live="polite">
              {periodLabel(period)}
            </h2>
            <Button variant="ghost" size="sm" aria-label={`Next ${unit}`} onClick={() => onChange(stepPeriod(period, 1))} className="!px-1.5">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </>
        )}
        {!isToday && (
          <button
            type="button"
            onClick={() => onChange(period.view === 'year' ? { view: 'year', year: today.year } : today)}
            className="ml-1 rounded-md px-1.5 py-1 text-[13px] text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {period.view === 'year' ? 'This year' : 'This month'}
          </button>
        )}
      </div>

      <div role="group" aria-label="Show budgets for" className="inline-flex rounded-md border border-line bg-surface p-0.5">
        {(['month', 'year'] as const).map((v) => {
          const on = period.view === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(switchView(period, v, now))}
              className={`h-7 rounded px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-accent ${
                on ? 'bg-sunk font-semibold text-ink' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {v === 'month' ? 'Month' : 'Year'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
