'use client';

import { useState, useEffect } from 'react';

interface FireInputs {
  id: string;
  currentAge: number;
  targetRetirementAge: number;
  annualSpend: number;
  withdrawalRate: number;
  expectedReturn: number;
  excludePropertyFromFire: boolean;
}

interface CoastFireSettingsProps {
  onSave?: () => void;
}

export function CoastFireSettings({ onSave }: CoastFireSettingsProps) {
  const [inputs, setInputs] = useState<FireInputs | null>(null);

  // Form state
  const [currentAge, setCurrentAge] = useState<number>(40);
  const [retirementAge, setRetirementAge] = useState<number>(50);
  const [annualSpend, setAnnualSpend] = useState<number>(50000);
  const [withdrawalRate, setWithdrawalRate] = useState<number>(4);
  const [expectedReturn, setExpectedReturn] = useState<number>(7);
  const [excludeProperty, setExcludeProperty] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch fire inputs - single source of truth
        const inputsRes = await fetch('/api/fire/inputs');
        if (inputsRes.ok) {
          const inputsData = await inputsRes.json();
          if (inputsData && inputsData.inputs && !inputsData.error) {
            setInputs(inputsData.inputs);
            setCurrentAge(inputsData.inputs.currentAge || 40);
            setRetirementAge(inputsData.inputs.targetRetirementAge || 50);
            setAnnualSpend(inputsData.inputs.annualSpend || 50000);
            setWithdrawalRate(inputsData.inputs.withdrawalRate || 4);
            setExpectedReturn(inputsData.inputs.expectedReturn || 7);
            setExcludeProperty(inputsData.inputs.excludePropertyFromFire ?? true);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Save all settings to fire_inputs
      const inputsRes = await fetch('/api/fire/inputs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentAge: currentAge,
          targetRetirementAge: retirementAge,
          annualSpend: annualSpend,
          withdrawalRate: withdrawalRate,
          expectedReturn: expectedReturn,
          excludePropertyFromFire: excludeProperty,
        }),
      });

      if (!inputsRes.ok) {
        const errorData = await inputsRes.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      // Update local state with saved data
      const savedData = await inputsRes.json();
      if (savedData.inputs) {
        setInputs(savedData.inputs);
      }

      setSuccessMessage('Settings saved successfully');

      if (onSave) {
        onSave();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const yearsLeft = retirementAge - currentAge;
  const fireNumber = annualSpend / (withdrawalRate / 100);
  const coastFire = yearsLeft > 0 ? fireNumber / Math.pow(1 + expectedReturn / 100, yearsLeft) : fireNumber;

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
          <div className="h-6 bg-slate-200 rounded w-48"></div>
          <div className="h-10 bg-slate-200 rounded"></div>
          <div className="h-10 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Coast FIRE Settings</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* Age inputs */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Age Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current Age
              </label>
              <input
                type="number"
                value={currentAge}
                onChange={(e) => setCurrentAge(parseInt(e.target.value) || 0)}
                min={18}
                max={100}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target Retirement Age
              </label>
              <input
                type="number"
                value={retirementAge}
                onChange={(e) => setRetirementAge(parseInt(e.target.value) || 0)}
                min={currentAge + 1}
                max={100}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {yearsLeft > 0 && (
            <p className="text-sm text-slate-500 mt-2">
              {yearsLeft} years until retirement
            </p>
          )}
        </div>

        {/* Financial inputs */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Financial Assumptions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Annual Spend (£)
              </label>
              <input
                type="number"
                value={annualSpend}
                onChange={(e) => setAnnualSpend(parseFloat(e.target.value) || 0)}
                min={0}
                step={1000}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Expected annual spending in retirement</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Safe Withdrawal Rate (%)
              </label>
              <input
                type="number"
                value={withdrawalRate}
                onChange={(e) => setWithdrawalRate(parseFloat(e.target.value) || 0)}
                min={0.1}
                max={10}
                step={0.1}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Typically 3-4% (Trinity Study)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expected Return (%)
              </label>
              <input
                type="number"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(parseFloat(e.target.value) || 0)}
                min={0}
                max={15}
                step={0.1}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Real return after inflation</p>
            </div>
          </div>
        </div>

        {/* Calculation Options */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Calculation Options</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeProperty}
                onChange={(e) => setExcludeProperty(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Exclude property from FIRE calculations</span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Property equity is typically illiquid and not available for withdrawal. Enable this to calculate Coast FIRE based only on investable assets.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Calculated values */}
        <div className="p-4 bg-slate-50 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Calculated Values</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-slate-600">FIRE Number</span>
                <p className="text-xs text-slate-400">Annual Spend / SWR%</p>
              </div>
              <span className="text-lg font-semibold text-slate-900">{formatCurrency(fireNumber)}</span>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-slate-600">Coast FIRE Target</span>
                  <p className="text-xs text-slate-400">Amount needed today to coast to retirement</p>
                </div>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(coastFire)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-white rounded border border-slate-200">
            <p className="text-xs text-slate-500">
              <strong>Formula:</strong> Coast FIRE = FIRE Number / (1 + Return%)^Years
              <br />
              = {formatCurrency(fireNumber)} / (1 + {expectedReturn}%)^{yearsLeft}
              <br />
              = {formatCurrency(fireNumber)} / {Math.pow(1 + expectedReturn / 100, yearsLeft).toFixed(4)}
              <br />
              = {formatCurrency(coastFire)}
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
