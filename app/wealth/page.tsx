'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  NetWorthSummary,
  NetWorthChart,
  AccountBalances,
  MonthlySnapshotForm,
  SnapshotHistoryTable,
  CoastFireCard,
  CoastFireSettings,
} from '@/components/wealth';
import type { NetWorthSummary as NetWorthSummaryType } from '@/lib/types/fire';

type ViewMode = 'dashboard' | 'entry' | 'history' | 'settings';

export default function WealthPage() {
  const [summaryData, setSummaryData] = useState<NetWorthSummaryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [coastFireKey, setCoastFireKey] = useState(0);

  const fetchNetWorth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/wealth/net-worth', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
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
  }, []);

  useEffect(() => {
    fetchNetWorth();
  }, [fetchNetWorth]);

  const handleSnapshotSaved = () => {
    // Refresh data when snapshots are saved
    fetchNetWorth();
    // Also refresh Coast FIRE card as net worth may have changed
    setCoastFireKey(prev => prev + 1);
  };

  const handleCoastFireSettingsSaved = () => {
    // Refresh Coast FIRE card when settings are updated
    setCoastFireKey(prev => prev + 1);
  };

  return (
    <AppLayout title="Investments & Net Worth">
      <div className="mb-6">
        <p className="text-gray-600 mt-1">
          Track your net worth across all accounts
        </p>

        {/* View Mode Tabs */}
        <div className="mt-4 border-b border-slate-200">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                viewMode === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('entry')}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                viewMode === 'entry'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Monthly Entry
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                viewMode === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setViewMode('settings')}
              className={`py-2 px-1 border-b-2 text-sm font-medium transition-colors ${
                viewMode === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <>
          <NetWorthSummary data={summaryData} isLoading={isLoading} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <NetWorthChart />
            </div>
            <div className="space-y-6">
              <CoastFireCard key={coastFireKey} />
              <AccountBalances data={summaryData} isLoading={isLoading} />
            </div>
          </div>
        </>
      )}

      {/* Monthly Entry View */}
      {viewMode === 'entry' && (
        <MonthlySnapshotForm onSaveComplete={handleSnapshotSaved} />
      )}

      {/* History View */}
      {viewMode === 'history' && (
        <SnapshotHistoryTable />
      )}

      {/* Settings View */}
      {viewMode === 'settings' && (
        <CoastFireSettings onSave={handleCoastFireSettingsSaved} />
      )}
    </AppLayout>
  );
}
