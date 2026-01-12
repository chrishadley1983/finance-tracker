'use client';

import { SummaryData } from '@/lib/hooks/useDashboardData';
import type { TimeframePeriod } from './TimeframeSelector';

interface SummaryCardsProps {
  data: SummaryData | null;
  isLoading: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPeriodLabel(period: TimeframePeriod): string {
  switch (period) {
    case 'this_month':
      return 'This Month';
    case 'last_month':
      return 'Last Month';
    case 'this_quarter':
      return 'This Quarter';
    case 'last_quarter':
      return 'Last Quarter';
    case 'this_year':
      return 'This Year';
    case 'last_year':
      return 'Last Year';
    case 'all_time':
      return 'All Time';
    case 'custom':
      return 'Selected Period';
    default:
      return 'Period';
  }
}

function SkeletonCard() {
  return (
    <div className="bg-slate-800 rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-slate-700 rounded w-24 mb-2"></div>
      <div className="h-8 bg-slate-700 rounded w-32"></div>
    </div>
  );
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const periodLabel = data?.period ? getPeriodLabel(data.period) : 'This Month';

  const cards = [
    {
      label: `Income (${periodLabel})`,
      value: data?.periodIncome ?? 0,
      colorClass: 'text-green-400',
    },
    {
      label: `Expenses (${periodLabel})`,
      value: data?.periodExpenses ?? 0,
      colorClass: 'text-red-400',
    },
    {
      label: `Net (${periodLabel})`,
      value: data?.periodNet ?? 0,
      colorClass: (data?.periodNet ?? 0) >= 0 ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">{card.label}</p>
          <p className={`text-2xl font-bold ${card.colorClass}`}>
            {formatCurrency(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
