'use client';

import { useState, useEffect } from 'react';

interface CoastFireData {
  coastFire: {
    value: number;
    fireNumberAtRetirement: number;
    currentNetWorth: number;
    progress: number;
    surplus: number;
    isCoastFI: boolean;
  } | null;
  inputs: {
    currentAge: number;
    targetRetirementAge: number;
    yearsLeft: number;
  };
  settings: {
    annualSpend: number;
    withdrawalRate: number;
    expectedReturn: number;
  };
  error?: string;
}

export function CoastFireCard() {
  const [data, setData] = useState<CoastFireData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCoastFire() {
      try {
        const response = await fetch('/api/fire/coast', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) throw new Error('Failed to fetch Coast FIRE data');
        const result = await response.json();
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCoastFire();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-slate-200 rounded w-32"></div>
          <div className="h-10 bg-slate-200 rounded w-48"></div>
          <div className="h-4 bg-slate-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-sm font-medium text-slate-500 mb-2">Coast FIRE</h3>
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  if (!data || !data.coastFire) {
    return null;
  }

  const { coastFire, inputs, settings } = data;
  const progressCapped = Math.min(coastFire.progress, 100);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-500">Coast FIRE Target</h3>
        {coastFire.isCoastFI && (
          <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
            Coast FI Achieved!
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="text-3xl font-bold text-slate-900">{formatCurrency(coastFire.value)}</p>
        <p className="text-sm text-slate-500 mt-1">
          Required today to retire at {inputs.targetRetirementAge} ({inputs.yearsLeft} years)
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-600">Progress</span>
          <span className={`font-medium ${coastFire.isCoastFI ? 'text-emerald-600' : 'text-slate-900'}`}>
            {coastFire.progress.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              coastFire.isCoastFI ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressCapped}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>Current: {formatCurrency(coastFire.currentNetWorth)}</span>
          <span>Target: {formatCurrency(coastFire.value)}</span>
        </div>
      </div>

      {/* Surplus/Deficit */}
      <div className={`p-3 rounded-lg ${coastFire.surplus >= 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        <div className="flex justify-between items-center">
          <span className={`text-sm ${coastFire.surplus >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {coastFire.surplus >= 0 ? 'Surplus' : 'Gap to Coast FI'}
          </span>
          <span className={`font-semibold ${coastFire.surplus >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {coastFire.surplus >= 0 ? '+' : ''}{formatCurrency(coastFire.surplus)}
          </span>
        </div>
      </div>

      {/* Settings details */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          {formatCurrency(settings.annualSpend)}/yr spend, {settings.withdrawalRate}% SWR, {settings.expectedReturn}% return
        </p>
        <p className="text-xs text-slate-400 mt-1">
          FIRE number at retirement: {formatCurrency(coastFire.fireNumberAtRetirement)}
        </p>
      </div>
    </div>
  );
}
