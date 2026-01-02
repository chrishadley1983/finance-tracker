'use client';

import { useState } from 'react';
import {
  INVESTMENT_PROVIDERS,
  INVESTMENT_PROVIDER_LABELS,
  INVESTMENT_TYPES,
  INVESTMENT_TYPE_LABELS,
  type InvestmentProvider,
  type InvestmentType,
} from '@/lib/types/investment';

interface AddAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    investmentProvider: InvestmentProvider;
    investmentType: InvestmentType;
    accountReference?: string;
  }) => Promise<void>;
}

export function AddAccountDialog({ isOpen, onClose, onSubmit }: AddAccountDialogProps) {
  const [name, setName] = useState('');
  const [investmentProvider, setInvestmentProvider] = useState<InvestmentProvider>('vanguard');
  const [investmentType, setInvestmentType] = useState<InvestmentType>('isa');
  const [accountReference, setAccountReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        investmentProvider,
        investmentType,
        accountReference: accountReference.trim() || undefined,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setInvestmentProvider('vanguard');
    setInvestmentType('isa');
    setAccountReference('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={handleClose}
        />

        {/* Dialog */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Add Investment Account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Vanguard ISA"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider *
              </label>
              <select
                value={investmentProvider}
                onChange={(e) => setInvestmentProvider(e.target.value as InvestmentProvider)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {INVESTMENT_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {INVESTMENT_PROVIDER_LABELS[provider]}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Type *
              </label>
              <select
                value={investmentType}
                onChange={(e) => setInvestmentType(e.target.value as InvestmentType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {INVESTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INVESTMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Reference
              </label>
              <input
                type="text"
                value={accountReference}
                onChange={(e) => setAccountReference(e.target.value)}
                placeholder="e.g., policy number or account ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional identifier for your records
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
