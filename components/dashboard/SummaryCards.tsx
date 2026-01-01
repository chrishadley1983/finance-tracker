'use client';

import { SummaryData } from '@/lib/hooks/useDashboardData';

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Balance',
      value: data?.totalBalance ?? 0,
      colorClass: 'text-white',
    },
    {
      label: 'Income (This Month)',
      value: data?.monthIncome ?? 0,
      colorClass: 'text-green-400',
    },
    {
      label: 'Expenses (This Month)',
      value: data?.monthExpenses ?? 0,
      colorClass: 'text-red-400',
    },
    {
      label: 'Net (This Month)',
      value: data?.monthNet ?? 0,
      colorClass: (data?.monthNet ?? 0) >= 0 ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
