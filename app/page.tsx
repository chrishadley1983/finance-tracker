'use client';

import { AppLayout } from '@/components/layout';
import {
  SummaryCards,
  RecentTransactions,
  SpendingByCategory,
  MonthlyTrend,
} from '@/components/dashboard';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

export default function DashboardPage() {
  const { summary, recentTransactions, categorySpend, monthlyTrend, isLoading, error } =
    useDashboardData();

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
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
            <SpendingByCategory data={categorySpend} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
