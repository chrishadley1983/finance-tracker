'use client';

import type { SavingsRate } from '@/lib/types/budget';
import { formatBudgetCurrency } from '@/lib/types/budget';

interface BudgetSummaryCardsProps {
  savingsRate: SavingsRate | null;
  isLoading: boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-20 mb-2"></div>
      <div className="h-8 bg-slate-200 rounded w-32 mb-1"></div>
      <div className="h-3 bg-slate-200 rounded w-16"></div>
    </div>
  );
}

export function BudgetSummaryCards({ savingsRate, isLoading }: BudgetSummaryCardsProps) {
  if (isLoading || !savingsRate) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const incomeVariance = savingsRate.totalIncomeActual - savingsRate.totalIncomeBudget;
  const expenseVariance = savingsRate.totalExpenseBudget - savingsRate.totalExpenseActual;
  const savingsVariance = savingsRate.savingsActual - savingsRate.savingsBudget;

  const cards = [
    {
      label: 'Income',
      budget: savingsRate.totalIncomeBudget,
      actual: savingsRate.totalIncomeActual,
      variance: incomeVariance,
      isGood: incomeVariance >= 0,
    },
    {
      label: 'Expenses',
      budget: savingsRate.totalExpenseBudget,
      actual: savingsRate.totalExpenseActual,
      variance: expenseVariance,
      isGood: expenseVariance >= 0,
    },
    {
      label: 'Savings',
      budget: savingsRate.savingsBudget,
      actual: savingsRate.savingsActual,
      variance: savingsVariance,
      isGood: savingsVariance >= 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <p className="text-sm font-medium text-slate-500">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatBudgetCurrency(card.actual)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Budget: {formatBudgetCurrency(card.budget)}
          </p>
          <p
            className={`text-sm font-medium ${
              card.isGood ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {card.variance >= 0 ? '+' : ''}
            {formatBudgetCurrency(card.variance)}
          </p>
        </div>
      ))}

      {/* Savings Rate Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-500">Savings Rate</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {savingsRate.savingsRateActual.toFixed(1)}%
          </span>
          <span className="text-sm text-slate-500">actual</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Budget: {savingsRate.savingsRateBudget.toFixed(1)}%
        </p>
        {/* Progress bar */}
        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              savingsRate.savingsRateActual >= savingsRate.savingsRateBudget
                ? 'bg-emerald-500'
                : 'bg-amber-500'
            }`}
            style={{
              width: `${Math.min(Math.max(savingsRate.savingsRateActual, 0), 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
