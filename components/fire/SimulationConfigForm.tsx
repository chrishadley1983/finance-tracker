'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, X, Info } from 'lucide-react';
import type { SimulationConfig, WithdrawalStrategy, ExtraIncomeSource } from '@/lib/types/fire';

type WithdrawalMode = 'rate' | 'amount';

interface SimulationConfigFormProps {
  config: SimulationConfig | null;
  onConfigChange: (config: SimulationConfig) => void;
  isLoading?: boolean;
  /** Optional note explaining how initial portfolio was calculated */
  portfolioNote?: string;
  /** Default annual spend amount (from Normal FIRE Spend setting) */
  defaultSpendAmount?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const WITHDRAWAL_STRATEGIES: { value: WithdrawalStrategy; label: string; description: string }[] = [
  {
    value: 'constant_dollar',
    label: 'Constant Dollar (4% Rule)',
    description: 'Withdraw a fixed amount each year (inflation-adjusted)',
  },
  {
    value: 'percent_of_portfolio',
    label: 'Percent of Portfolio',
    description: 'Withdraw a fixed percentage of current portfolio each year',
  },
];

export function SimulationConfigForm({
  config,
  onConfigChange,
  isLoading = false,
  portfolioNote,
  defaultSpendAmount = 55000,
}: SimulationConfigFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<SimulationConfig>({
    retirementDuration: config?.retirementDuration ?? 30,
    stockAllocation: config?.stockAllocation ?? 75,
    bondAllocation: config?.bondAllocation ?? 25,
    withdrawalStrategy: config?.withdrawalStrategy ?? 'constant_dollar',
    initialWithdrawalRate: config?.initialWithdrawalRate ?? 4,
    initialWithdrawalAmount: config?.initialWithdrawalAmount ?? defaultSpendAmount,
    initialPortfolio: config?.initialPortfolio ?? 1000000,
    extraIncome: config?.extraIncome ?? [],
    currentAge: config?.currentAge ?? 65,
  });

  // Track whether user wants to specify withdrawal as rate or fixed amount
  const [withdrawalMode, setWithdrawalMode] = useState<WithdrawalMode>(
    config?.initialWithdrawalAmount ? 'amount' : 'rate'
  );

  const [includeStatePension, setIncludeStatePension] = useState(
    config?.extraIncome?.some(e => e.name === 'State Pension') ?? true
  );
  const [statePensionAge, setStatePensionAge] = useState(67);
  const [statePensionAmount, setStatePensionAmount] = useState(11500);

  // Sync form data when config changes
  useEffect(() => {
    if (config) {
      setFormData({
        ...config,
        initialWithdrawalAmount: config.initialWithdrawalAmount ?? defaultSpendAmount,
      });
      setWithdrawalMode(config.initialWithdrawalAmount ? 'amount' : 'rate');
      const pension = config.extraIncome.find(e => e.name === 'State Pension');
      setIncludeStatePension(!!pension);
      if (pension) {
        setStatePensionAge(pension.startAge);
        setStatePensionAmount(pension.annualAmount);
      }
    }
  }, [config, defaultSpendAmount]);

  const handleStockAllocationChange = (value: number) => {
    const stockAllocation = Math.min(100, Math.max(0, value));
    const bondAllocation = 100 - stockAllocation;
    setFormData(prev => ({ ...prev, stockAllocation, bondAllocation }));
  };

  const handleSave = () => {
    // Build extra income array
    const extraIncome: ExtraIncomeSource[] = [];
    if (includeStatePension) {
      extraIncome.push({
        name: 'State Pension',
        annualAmount: statePensionAmount,
        startAge: statePensionAge,
        adjustForInflation: true,
      });
    }

    // Calculate withdrawal rate from amount if in amount mode
    let withdrawalRate = formData.initialWithdrawalRate;
    let withdrawalAmount = formData.initialWithdrawalAmount;

    if (withdrawalMode === 'amount' && formData.initialPortfolio > 0) {
      // Calculate the effective rate from the fixed amount
      withdrawalRate = ((withdrawalAmount ?? defaultSpendAmount) / formData.initialPortfolio) * 100;
    } else {
      // In rate mode, clear the fixed amount
      withdrawalAmount = undefined;
    }

    const newConfig: SimulationConfig = {
      ...formData,
      initialWithdrawalRate: withdrawalRate,
      initialWithdrawalAmount: withdrawalAmount,
      extraIncome,
    };

    onConfigChange(newConfig);
    setIsEditing(false);
  };

  const calculatedWithdrawal = formData.initialPortfolio * (formData.initialWithdrawalRate / 100);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm mb-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Simulation Configuration
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Portfolio at {formData.currentAge}: <span className="font-medium">{formatCurrency(formData.initialPortfolio)}</span>
              {' · '}
              Duration: <span className="font-medium">{formData.retirementDuration} years</span>
              {' · '}
              Withdrawal: <span className="font-medium">
                {formData.initialWithdrawalAmount
                  ? `${formatCurrency(formData.initialWithdrawalAmount)}/yr`
                  : `${formData.initialWithdrawalRate}%`}
              </span>
              {' · '}
              Allocation: <span className="font-medium">{formData.stockAllocation}/{formData.bondAllocation}</span>
              {includeStatePension && (
                <>
                  {' · '}
                  <span className="text-emerald-600 dark:text-emerald-400">State Pension @ {statePensionAge}</span>
                </>
              )}
            </p>
            {portfolioNote && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {portfolioNote}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Settings className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Edit Configuration</h3>
        <button
          onClick={() => setIsEditing(false)}
          className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Portfolio Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Initial Portfolio
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
            <input
              type="number"
              value={formData.initialPortfolio}
              onChange={(e) => setFormData(prev => ({ ...prev, initialPortfolio: parseFloat(e.target.value) || 0 }))}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min={0}
              step={10000}
            />
          </div>
        </div>

        {/* Current Age */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Retirement Age
          </label>
          <input
            type="number"
            value={formData.currentAge}
            onChange={(e) => setFormData(prev => ({ ...prev, currentAge: parseInt(e.target.value) || 65 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={30}
            max={100}
          />
        </div>

        {/* Retirement Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Duration (years)
          </label>
          <input
            type="number"
            value={formData.retirementDuration}
            onChange={(e) => setFormData(prev => ({ ...prev, retirementDuration: parseInt(e.target.value) || 30 }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={10}
            max={60}
          />
          <p className="text-xs text-gray-500 mt-1">Simulate to age {formData.currentAge + formData.retirementDuration}</p>
        </div>

        {/* Withdrawal Strategy */}
        <div className="md:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Withdrawal Strategy
          </label>
          <select
            value={formData.withdrawalStrategy}
            onChange={(e) => setFormData(prev => ({ ...prev, withdrawalStrategy: e.target.value as WithdrawalStrategy }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {WITHDRAWAL_STRATEGIES.map(strategy => (
              <option key={strategy.value} value={strategy.value}>
                {strategy.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {WITHDRAWAL_STRATEGIES.find(s => s.value === formData.withdrawalStrategy)?.description}
          </p>
        </div>

        {/* Withdrawal Input Mode Toggle */}
        <div className="md:col-span-2 lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Annual Withdrawal
          </label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setWithdrawalMode('amount')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                withdrawalMode === 'amount'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Fixed Amount
            </button>
            <button
              type="button"
              onClick={() => setWithdrawalMode('rate')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                withdrawalMode === 'rate'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Withdrawal Rate
            </button>
          </div>

          {withdrawalMode === 'amount' ? (
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <input
                  type="number"
                  value={formData.initialWithdrawalAmount ?? defaultSpendAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, initialWithdrawalAmount: parseFloat(e.target.value) || defaultSpendAmount }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min={0}
                  step={1000}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                = {((formData.initialWithdrawalAmount ?? defaultSpendAmount) / formData.initialPortfolio * 100).toFixed(2)}% of portfolio (from Normal FIRE Spend)
              </p>
            </div>
          ) : (
            <div>
              <div className="relative">
                <input
                  type="number"
                  value={formData.initialWithdrawalRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, initialWithdrawalRate: parseFloat(e.target.value) || 4 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min={1}
                  max={10}
                  step={0.25}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                = {formatCurrency(calculatedWithdrawal)}/year
              </p>
            </div>
          )}
        </div>

        {/* Stock/Bond Allocation */}
        <div className="md:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Asset Allocation: {formData.stockAllocation}% Stocks / {formData.bondAllocation}% Bonds
          </label>
          <input
            type="range"
            value={formData.stockAllocation}
            onChange={(e) => handleStockAllocationChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-emerald-500"
            min={0}
            max={100}
            step={5}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>100% Bonds</span>
            <span>Balanced</span>
            <span>100% Stocks</span>
          </div>
        </div>

        {/* State Pension */}
        <div className="md:col-span-2 lg:col-span-3 border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="statePension"
              checked={includeStatePension}
              onChange={(e) => setIncludeStatePension(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="statePension" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Include State Pension
            </label>
          </div>

          {includeStatePension && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Start Age
                </label>
                <input
                  type="number"
                  value={statePensionAge}
                  onChange={(e) => setStatePensionAge(parseInt(e.target.value) || 67)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min={60}
                  max={75}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Annual Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                  <input
                    type="number"
                    value={statePensionAmount}
                    onChange={(e) => setStatePensionAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min={0}
                    step={100}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">How Historical Simulation Works</p>
            <p className="text-blue-700 dark:text-blue-300">
              We test your retirement plan against every historical period from 1928 to today.
              The success rate shows what percentage of these periods would have sustained your withdrawals
              for the full duration. Uses real (inflation-adjusted) returns.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={() => setIsEditing(false)}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Save className="h-4 w-4" />
          Run Simulation
        </button>
      </div>
    </div>
  );
}
