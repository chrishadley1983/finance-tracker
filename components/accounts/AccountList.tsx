'use client';

import type { AccountWithStats } from '@/lib/types/account';
import { AccountCard } from './AccountCard';

interface AccountListProps {
  accounts: AccountWithStats[];
  onEdit: (account: AccountWithStats) => void;
  onDelete: (account: AccountWithStats) => void;
  onReallocate: (account: AccountWithStats) => void;
  onArchiveToggle: (account: AccountWithStats) => void;
  onViewSnapshots?: (account: AccountWithStats) => void;
  isLoading?: boolean;
}

export function AccountList({
  accounts,
  onEdit,
  onDelete,
  onReallocate,
  onArchiveToggle,
  onViewSnapshots,
  isLoading = false,
}: AccountListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm animate-pulse"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 bg-gray-200 rounded" />
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <svg
          className="mx-auto w-12 h-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No accounts found</h3>
        <p className="text-gray-500">
          Add your first account to start tracking your finances.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onEdit={() => onEdit(account)}
          onDelete={() => onDelete(account)}
          onReallocate={() => onReallocate(account)}
          onArchiveToggle={() => onArchiveToggle(account)}
          onViewSnapshots={onViewSnapshots ? () => onViewSnapshots(account) : undefined}
        />
      ))}
    </div>
  );
}
