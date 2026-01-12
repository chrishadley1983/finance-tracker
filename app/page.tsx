'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout';
import {
  SummaryCards,
  RecentTransactions,
  SpendingByCategory,
  IncomeByCategory,
  MonthlyTrend,
  TimeframeSelector,
  NetWorthSummary,
  TimeframePeriod,
} from '@/components/dashboard';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

export default function DashboardPage() {
  const [period, setPeriod] = useState<TimeframePeriod>('last_month');
  const [customStart, setCustomStart] = useState<string | undefined>();
  const [customEnd, setCustomEnd] = useState<string | undefined>();

  const { summary, accountSummary, recentTransactions, categorySpend, incomeByCategory, monthlyTrend, isLoading, error } =
    useDashboardData({ period, customStart, customEnd });

  const handleTimeframeChange = (
    newPeriod: TimeframePeriod,
    newCustomStart?: string,
    newCustomEnd?: string
  ) => {
    setPeriod(newPeriod);
    setCustomStart(newCustomStart);
    setCustomEnd(newCustomEnd);
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Net Worth Summary - Above timeframe selector */}
        <NetWorthSummary
          netWorth={accountSummary?.netWorth ?? 0}
          accountTypeBalances={accountSummary?.accountTypeBalances ?? []}
          isLoading={isLoading}
        />

        {/* Timeframe Selector */}
        <div className="flex items-center justify-between">
          <TimeframeSelector
            value={period}
            onChange={handleTimeframeChange}
            customStart={customStart}
            customEnd={customEnd}
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Summary Cards - Full width */}
        <SummaryCards data={summary} isLoading={isLoading} />

        {/* 2-column grid */}
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-6">
            <RecentTransactions transactions={recentTransactions} isLoading={isLoading} />
            <MonthlyTrend data={monthlyTrend} isLoading={isLoading} />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <SpendingByCategory
              data={categorySpend}
              isLoading={isLoading}
              dateFrom={summary?.startDate}
              dateTo={summary?.endDate}
            />
            <IncomeByCategory
              data={incomeByCategory}
              isLoading={isLoading}
              dateFrom={summary?.startDate}
              dateTo={summary?.endDate}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
