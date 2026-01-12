'use client';

import { TrendingUp, TrendingDown, Wallet, Target } from 'lucide-react';
import type { HistoricalSimulationResults } from '@/lib/types/fire';

interface SimulationSummaryCardsProps {
  results: HistoricalSimulationResults | null;
  isLoading?: boolean;
}

function formatCurrency(amount: number): string {
  if (!isFinite(amount) || amount === 0) return '---';
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}k`;
  }
  return `£${amount.toFixed(0)}`;
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'amber' | 'purple' | 'red';
}

function SummaryCard({ title, value, subtitle, icon, color }: SummaryCardProps) {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
        <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

export function SimulationSummaryCards({
  results,
  isLoading = false,
}: SimulationSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const {
    medianFinalPortfolio,
    finalPortfolioPercentiles,
    bestCase,
    smallestFinalPortfolio,
    config,
  } = results;

  // Initial withdrawal amount
  const initialWithdrawal = config.initialWithdrawalAmount !== undefined
    ? config.initialWithdrawalAmount
    : config.initialPortfolio * (config.initialWithdrawalRate / 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SummaryCard
        title="Median Final Portfolio"
        value={formatCurrency(medianFinalPortfolio)}
        subtitle={`Range: ${formatCurrency(finalPortfolioPercentiles.p10)} - ${formatCurrency(finalPortfolioPercentiles.p90)}`}
        icon={<TrendingUp className="h-5 w-5" />}
        color="emerald"
      />

      <SummaryCard
        title="Annual Withdrawal"
        value={formatCurrency(initialWithdrawal)}
        subtitle={`${config.initialWithdrawalRate}% of ${formatCurrency(config.initialPortfolio)}`}
        icon={<Wallet className="h-5 w-5" />}
        color="blue"
      />

      <SummaryCard
        title="Best Case"
        value={formatCurrency(bestCase.finalValue)}
        subtitle={`Started ${bestCase.startYear}`}
        icon={<Target className="h-5 w-5" />}
        color="purple"
      />

      <SummaryCard
        title="Smallest"
        value={formatCurrency(smallestFinalPortfolio.finalValue)}
        subtitle={`Started ${smallestFinalPortfolio.startYear}`}
        icon={<TrendingDown className="h-5 w-5" />}
        color="amber"
      />
    </div>
  );
}
