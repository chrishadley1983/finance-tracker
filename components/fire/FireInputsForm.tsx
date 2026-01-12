'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, X } from 'lucide-react';
import type { FireInputs } from '@/lib/types/fire';

interface FireInputsFormProps {
  inputs: FireInputs | null;
  portfolioValue?: number;
  onSave: (inputs: Partial<FireInputs>) => Promise<void>;
  isLoading?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FireInputsForm({
  inputs,
  portfolioValue,
  onSave,
  isLoading = false,
}: FireInputsFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    currentAge: inputs?.currentAge ?? 35,
    dateOfBirth: inputs?.dateOfBirth ?? '',
    targetRetirementAge: inputs?.targetRetirementAge ?? 55,
    currentPortfolioValue: inputs?.currentPortfolioValue ?? portfolioValue ?? 0,
    annualIncome: inputs?.annualIncome ?? 0,
    annualSavings: inputs?.annualSavings ?? 18000, // Default £1,500/month
    expectedReturn: inputs?.expectedReturn ?? 7,
    withdrawalRate: inputs?.withdrawalRate ?? 4,
    includeStatePension: inputs?.includeStatePension ?? true,
    partnerStatePension: inputs?.partnerStatePension ?? false,
    normalFireSpend: inputs?.normalFireSpend ?? 55000,
    fatFireSpend: inputs?.fatFireSpend ?? 65000,
  });

  // Update form data when inputs load from API
  useEffect(() => {
    if (inputs) {
      setFormData({
        currentAge: inputs.currentAge ?? 35,
        dateOfBirth: inputs.dateOfBirth ?? '',
        targetRetirementAge: inputs.targetRetirementAge ?? 55,
        currentPortfolioValue: inputs.currentPortfolioValue ?? portfolioValue ?? 0,
        annualIncome: inputs.annualIncome ?? 0,
        annualSavings: inputs.annualSavings ?? 18000,
        expectedReturn: inputs.expectedReturn ?? 7,
        withdrawalRate: inputs.withdrawalRate ?? 4,
        includeStatePension: inputs.includeStatePension ?? true,
        partnerStatePension: inputs.partnerStatePension ?? false,
        normalFireSpend: inputs.normalFireSpend ?? 55000,
        fatFireSpend: inputs.fatFireSpend ?? 65000,
      });
    }
  }, [inputs, portfolioValue]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        currentAge: formData.currentAge,
        dateOfBirth: formData.dateOfBirth || null,
        targetRetirementAge: formData.targetRetirementAge || null,
        currentPortfolioValue: formData.currentPortfolioValue || null,
        annualIncome: formData.annualIncome || null,
        annualSavings: formData.annualSavings || null,
        expectedReturn: formData.expectedReturn,
        withdrawalRate: formData.withdrawalRate,
        includeStatePension: formData.includeStatePension,
        partnerStatePension: formData.partnerStatePension,
        normalFireSpend: formData.normalFireSpend,
        fatFireSpend: formData.fatFireSpend,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const displayPortfolio = inputs?.currentPortfolioValue ?? portfolioValue ?? 0;
  const displaySavings = inputs?.annualSavings ?? 0;

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
              Your Inputs
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Age: <span className="font-medium">{inputs?.currentAge ?? 35}</span>
              {' · '}
              Portfolio: <span className="font-medium">{formatCurrency(displayPortfolio)}</span>
              {' · '}
              Saving: <span className="font-medium">{formatCurrency(displaySavings)}/yr</span>
              {' · '}
              Return: <span className="font-medium">{inputs?.expectedReturn ?? 7}%</span>
              {' · '}
              SWR: <span className="font-medium">{inputs?.withdrawalRate ?? 4}%</span>
              {inputs?.includeStatePension && (
                <>
                  {' · '}
                  <span className="text-emerald-600 dark:text-emerald-400">State Pension included</span>
                </>
              )}
            </p>
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
        <h3 className="font-semibold text-gray-900 dark:text-white">Edit Your Inputs</h3>
        <button
          onClick={() => setIsEditing(false)}
          className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date of Birth
          </label>
          <input
            type="date"
            value={formData.dateOfBirth || ''}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 mt-1">For exact age calculation</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Age
          </label>
          <input
            type="number"
            value={formData.currentAge}
            onChange={(e) => setFormData({ ...formData, currentAge: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={18}
            max={100}
          />
          {formData.dateOfBirth && (
            <p className="text-xs text-gray-500 mt-1">DOB will override this</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Retirement Age
          </label>
          <input
            type="number"
            value={formData.targetRetirementAge || ''}
            onChange={(e) => setFormData({ ...formData, targetRetirementAge: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={30}
            max={100}
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Portfolio Value
          </label>
          <input
            type="number"
            value={formData.currentPortfolioValue || ''}
            onChange={(e) => setFormData({ ...formData, currentPortfolioValue: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={0}
            placeholder={portfolioValue ? `Auto: ${formatCurrency(portfolioValue)}` : '0'}
          />
          {portfolioValue && !formData.currentPortfolioValue && (
            <p className="text-xs text-gray-500 mt-1">Auto-calculated from investments</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Annual Income
          </label>
          <input
            type="number"
            value={formData.annualIncome || ''}
            onChange={(e) => setFormData({ ...formData, annualIncome: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={0}
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Monthly Savings
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
            <input
              type="number"
              value={Math.round((formData.annualSavings || 0) / 12) || ''}
              onChange={(e) => setFormData({ ...formData, annualSavings: (parseFloat(e.target.value) || 0) * 12 })}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min={0}
              step={100}
              placeholder="1500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Annual: {formatCurrency(formData.annualSavings || 0)}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Expected Real Return (%)
          </label>
          <input
            type="number"
            value={formData.expectedReturn}
            onChange={(e) => setFormData({ ...formData, expectedReturn: parseFloat(e.target.value) || 7 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={0}
            max={15}
            step={0.5}
          />
          <p className="text-xs text-gray-500 mt-1">After inflation (default 7%)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Safe Withdrawal Rate (%)
          </label>
          <input
            type="number"
            value={formData.withdrawalRate}
            onChange={(e) => setFormData({ ...formData, withdrawalRate: parseFloat(e.target.value) || 4 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={1}
            max={10}
            step={0.25}
          />
          <p className="text-xs text-gray-500 mt-1">For FIRE target calc (default 4%)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Normal FIRE Spend
          </label>
          <input
            type="number"
            value={formData.normalFireSpend || ''}
            onChange={(e) => setFormData({ ...formData, normalFireSpend: parseFloat(e.target.value) || 55000 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={0}
            step={1000}
          />
          <p className="text-xs text-gray-500 mt-1">Annual spend for Normal FIRE</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            FAT FIRE Spend
          </label>
          <input
            type="number"
            value={formData.fatFireSpend || ''}
            onChange={(e) => setFormData({ ...formData, fatFireSpend: parseFloat(e.target.value) || 65000 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min={0}
            step={1000}
          />
          <p className="text-xs text-gray-500 mt-1">Annual spend for FAT FIRE</p>
        </div>

        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.includeStatePension}
              onChange={(e) => setFormData({ ...formData, includeStatePension: e.target.checked })}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include State Pension</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={formData.partnerStatePension}
              onChange={(e) => setFormData({ ...formData, partnerStatePension: e.target.checked })}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Partner State Pension</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={() => setIsEditing(false)}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
