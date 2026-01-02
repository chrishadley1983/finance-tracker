'use client';

import { useState, useEffect } from 'react';
import { NetWorthSummary, NetWorthChart, AccountBalances } from '@/components/wealth';
import type { NetWorthSummary as NetWorthSummaryType } from '@/lib/types/fire';

export default function WealthPage() {
  const [summaryData, setSummaryData] = useState<NetWorthSummaryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNetWorth() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/wealth/net-worth');
        if (!response.ok) {
          throw new Error('Failed to fetch net worth');
        }
        const data = await response.json();
        setSummaryData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchNetWorth();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Wealth Tracker
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Track your net worth across all accounts
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <NetWorthSummary data={summaryData} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NetWorthChart />
        </div>
        <div>
          <AccountBalances data={summaryData} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
