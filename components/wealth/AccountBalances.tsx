'use client';

import { Wallet, PiggyBank, BarChart3, Building2 } from 'lucide-react';
import type { NetWorthSummary } from '@/lib/types/fire';
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/fire';

interface AccountBalancesProps {
  data: NetWorthSummary | null;
  isLoading?: boolean;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  investment: <BarChart3 className="h-4 w-4" />,
  savings: <PiggyBank className="h-4 w-4" />,
  current: <Wallet className="h-4 w-4" />,
  pension: <BarChart3 className="h-4 w-4" />,
  isa: <PiggyBank className="h-4 w-4" />,
  property: <Building2 className="h-4 w-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  investment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pension: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  isa: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  savings: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  current: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  property: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AccountBalances({ data, isLoading = false }: AccountBalancesProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Account Balances
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.byAccount.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Account Balances
          </h3>
        </div>
        <div className="p-4">
          <p className="text-gray-500 dark:text-gray-400">No accounts found</p>
        </div>
      </div>
    );
  }

  // Group accounts by type
  const groupedAccounts = data.byAccount.reduce(
    (acc, account) => {
      const type = account.accountType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(account);
      return acc;
    },
    {} as Record<string, typeof data.byAccount>
  );

  // Sort types by total value
  const sortedTypes = Object.entries(groupedAccounts)
    .map(([type, accounts]) => ({
      type,
      accounts,
      total: accounts.reduce((sum, a) => sum + a.balance, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Account Balances
        </h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedTypes.map(({ type, accounts }) => (
          <div key={type} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                  TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {TYPE_ICONS[type] || <Wallet className="h-3 w-3" />}
                {ACCOUNT_TYPE_LABELS[type] || type}
              </span>
            </div>
            <div className="space-y-2">
              {accounts
                .sort((a, b) => b.balance - a.balance)
                .map((account) => (
                  <div
                    key={account.accountId}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {account.accountName}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        account.balance >= 0
                          ? 'text-gray-900 dark:text-white'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(account.balance)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
