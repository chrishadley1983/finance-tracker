'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  MathsPlanningTab,
  FireInputsForm,
} from '@/components/fire';
import { ErnDashboard } from '@/components/fire/ern';
import type {
  FireInputs,
  NetWorthSummary,
} from '@/lib/types/fire';

type FireTab = 'ern-analysis' | 'maths-planning' | 'settings';

export default function FirePage() {
  const [activeTab, setActiveTab] = useState<FireTab>('ern-analysis');
  const [fireInputs, setFireInputs] = useState<FireInputs | null>(null);
  const [netWorth, setNetWorth] = useState<NetWorthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data for settings + maths planning
  const fetchInitialData = useCallback(async () => {
    try {
      const [inputsRes, nwRes] = await Promise.all([
        fetch('/api/fire/inputs'),
        fetch('/api/wealth/net-worth'),
      ]);
      if (inputsRes.ok) {
        const data = await inputsRes.json();
        setFireInputs(data.inputs);
      }
      if (nwRes.ok) {
        setNetWorth(await nwRes.json());
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSaveInputs = async (updatedInputs: Partial<FireInputs>) => {
    try {
      const response = await fetch('/api/fire/inputs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fireInputs, ...updatedInputs }),
      });
      if (response.ok) {
        const data = await response.json();
        setFireInputs(data.inputs);
      }
    } catch (err) {
      console.error('Error saving inputs:', err);
    }
  };

  return (
    <AppLayout title="FIRE Calculator">
      <div className="mb-6">
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Financial Independence, Retire Early projections
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('ern-analysis')}
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'ern-analysis'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            ERN Analysis
          </button>
          <button
            onClick={() => setActiveTab('maths-planning')}
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'maths-planning'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Maths Planning
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Settings
          </button>
        </nav>
      </div>

      {activeTab === 'ern-analysis' && (
        <ErnDashboard fireInputs={fireInputs} />
      )}

      {activeTab === 'maths-planning' && (
        <MathsPlanningTab
          fireInputs={fireInputs}
          netWorth={netWorth}
          isLoading={isLoading && !fireInputs}
        />
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              FIRE Calculator Settings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              These settings are used across both the Historical Simulation and Maths Planning tabs.
              Your date of birth is used to calculate your exact age for projections.
            </p>
            <FireInputsForm
              inputs={fireInputs}
              onSave={handleSaveInputs}
              isLoading={isLoading && !fireInputs}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
