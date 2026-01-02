'use client';

import { useState } from 'react';
import type { AccountWithStats } from '@/lib/types/account';
import { getAccountIcon, getAccountTypeLabel } from '@/lib/types/account';

interface AccountCardProps {
  account: AccountWithStats;
  onEdit: () => void;
  onDelete: () => void;
  onReallocate: () => void;
  onArchiveToggle: () => void;
}

export function AccountCard({
  account,
  onEdit,
  onDelete,
  onReallocate,
  onArchiveToggle,
}: AccountCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const icon = getAccountIcon(account.type, account.icon);
  const typeLabel = getAccountTypeLabel(account.type);
  const isInvestmentType = ['investment', 'pension', 'isa'].includes(account.type);

  return (
    <div
      className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
        account.is_archived ? 'opacity-60 border-gray-200' : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{account.name}</h3>
              {account.is_archived && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                  Archived
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {typeLabel}
              {account.provider && ` · ${account.provider}`}
            </p>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="Account menu"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                <button
                  onClick={() => {
                    onEdit();
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    onArchiveToggle();
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {account.is_archived ? 'Unarchive' : 'Archive'}
                </button>
                {account.transactionCount > 0 && (
                  <button
                    onClick={() => {
                      onReallocate();
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Move Transactions
                  </button>
                )}
                <button
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="mb-3">
        <p
          className={`text-2xl font-bold ${
            account.currentBalance >= 0 ? 'text-gray-900' : 'text-red-600'
          }`}
        >
          {formatCurrency(account.currentBalance)}
        </p>
        {isInvestmentType && account.latestValuation ? (
          <p className="text-sm text-gray-500">
            as of {formatDate(account.latestValuation)}
          </p>
        ) : account.latestTransaction ? (
          <p className="text-sm text-gray-500">
            calculated from transactions
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">No transactions</p>
        )}
      </div>

      {/* Stats */}
      <div className="space-y-1 text-sm text-gray-600 border-t border-gray-100 pt-3">
        {account.transactionCount > 0 ? (
          <>
            <div className="flex justify-between">
              <span>Transactions:</span>
              <span className="font-medium">{account.transactionCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Date range:</span>
              <span className="font-medium">
                {formatDate(account.earliestTransaction)} - {formatDate(account.latestTransaction)}
              </span>
            </div>
          </>
        ) : isInvestmentType && account.valuationCount ? (
          <div className="flex justify-between">
            <span>Valuations:</span>
            <span className="font-medium">{account.valuationCount}</span>
          </div>
        ) : (
          <p className="text-gray-400 italic">No data recorded</p>
        )}

        {account.last_import_at && (
          <div className="flex justify-between">
            <span>Last import:</span>
            <span className="font-medium">
              {formatRelativeTime(account.last_import_at)}
            </span>
          </div>
        )}

        {!account.include_in_net_worth && (
          <p className="text-amber-600 text-xs mt-2">
            Excluded from net worth
          </p>
        )}
      </div>
    </div>
  );
}
