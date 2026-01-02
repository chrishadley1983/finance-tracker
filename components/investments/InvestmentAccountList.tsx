'use client';

import { type InvestmentAccount } from '@/lib/types/investment';
import { InvestmentAccountCard } from './InvestmentAccountCard';

interface InvestmentAccountListProps {
  accounts: InvestmentAccount[];
  isLoading: boolean;
  onAddValuation: (accountId: string) => void;
  onViewHistory: (accountId: string) => void;
  onEdit: (account: InvestmentAccount) => void;
  onDelete: (accountId: string) => void;
  onAddAccount: () => void;
}

export function InvestmentAccountList({
  accounts,
  isLoading,
  onAddValuation,
  onViewHistory,
  onEdit,
  onDelete,
  onAddAccount,
}: InvestmentAccountListProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calculate total value
  const totalValue = accounts.reduce((sum, account) => {
    return sum + (account.latestValuation?.value || 0);
  }, 0);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No investment accounts</h3>
        <p className="mt-2 text-sm text-gray-500">
          Add your first account to start tracking your investments.
        </p>
        <button
          onClick={onAddAccount}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Value Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Total Portfolio Value</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
        </div>
        <p className="text-sm text-gray-500">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Account Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <InvestmentAccountCard
            key={account.id}
            account={account}
            onAddValuation={onAddValuation}
            onViewHistory={onViewHistory}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
