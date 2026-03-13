'use client';

import { useState } from 'react';
import { TrendingUp, Shield, Target, Activity } from 'lucide-react';

interface ErnSummaryCardsProps {
  failSafeSwr: number;
  medianSwr: number;
  ernDynamicWr: number;
  personalWr: number;
  currentCape: number;
  mcSurvivalRate: number | null;
  totalCohorts: number;
  isLoading?: boolean;
}

function formatPct(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

function Card({
  title,
  value,
  subtitle,
  tooltip,
  icon,
  color,
  isLoading,
}: {
  title: string;
  value: string;
  subtitle: string;
  tooltip: string;
  icon: React.ReactNode;
  color: string;
  isLoading?: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm relative cursor-help"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</span>
        <div className={color}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      {showTooltip && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg leading-relaxed">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>
      )}
    </div>
  );
}

export function ErnSummaryCards({
  failSafeSwr,
  medianSwr,
  ernDynamicWr,
  personalWr,
  currentCape,
  mcSurvivalRate,
  totalCohorts,
  isLoading = false,
}: ErnSummaryCardsProps) {
  const wrDelta = personalWr - ernDynamicWr;
  const wrStatus = wrDelta <= 0 ? 'Below ERN WR' : wrDelta < 0.5 ? 'Near ERN WR' : 'Above ERN WR';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card
        title="Fail-Safe SWR"
        value={formatPct(failSafeSwr)}
        subtitle={`Worst of ${totalCohorts} cohorts (1871-2026)`}
        tooltip={`The lowest safe withdrawal rate across every possible retirement start date since 1871. If you'd retired in the single worst month in history, ${formatPct(failSafeSwr)} is the most you could have withdrawn annually without running out over your full horizon. This is the absolute floor — ultra-conservative.`}
        icon={<Shield className="h-5 w-5" />}
        color="text-emerald-500"
        isLoading={isLoading}
      />
      <Card
        title="ERN Dynamic WR"
        value={formatPct(ernDynamicWr)}
        subtitle={`CAPE ${currentCape} (1.75 + 0.50 × 1/CAPE)`}
        tooltip={`A market-aware withdrawal rate using ERN's regression formula. When CAPE (a valuation measure) is high, future returns tend to be lower, so this rate drops. At today's CAPE of ${currentCape}, it suggests withdrawing less than the historical fail-safe. Based on ERN Safe Withdrawal Rate Series Parts 18 & 54.`}
        icon={<Target className="h-5 w-5" />}
        color="text-blue-500"
        isLoading={isLoading}
      />
      <Card
        title="Your Withdrawal Rate"
        value={formatPct(personalWr)}
        subtitle={wrStatus}
        tooltip={`Your annual spend divided by your portfolio value at retirement. This is what you're actually planning to withdraw. Compare it to the ERN Dynamic WR — if yours is higher, you're taking more risk than current market valuations suggest is safe. The gap between the two rates is where sequence-of-returns risk lives.`}
        icon={<TrendingUp className="h-5 w-5" />}
        color={wrDelta > 0.5 ? 'text-red-500' : wrDelta > 0 ? 'text-yellow-500' : 'text-emerald-500'}
        isLoading={isLoading}
      />
      <Card
        title="MC Survival"
        value={mcSurvivalRate !== null ? formatPct(mcSurvivalRate, 1) : '--'}
        subtitle={mcSurvivalRate !== null ? '500-path block bootstrap' : 'Not yet run'}
        tooltip={`Percentage of 500 simulated futures where your portfolio didn't run out. Uses block-bootstrap resampling (60-month blocks) from real historical returns, preserving the clustering of good and bad periods seen in real markets. Accounts for state pension income and spending adjustments. Above 95% is generally considered robust.`}
        icon={<Activity className="h-5 w-5" />}
        color={
          mcSurvivalRate === null
            ? 'text-gray-400'
            : mcSurvivalRate >= 95
            ? 'text-emerald-500'
            : mcSurvivalRate >= 80
            ? 'text-green-500'
            : 'text-red-500'
        }
        isLoading={isLoading}
      />
    </div>
  );
}
