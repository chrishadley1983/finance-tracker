'use client';

import { useState } from 'react';
import {
  type InvestmentAccount,
  INVESTMENT_TYPE_LABELS,
  type InvestmentType,
} from '@/lib/types/investment';

interface InvestmentAccountCardProps {
  account: InvestmentAccount;
  onAddValuation: (accountId: string) => void;
  onViewHistory: (accountId: string) => void;
  onEdit: (account: InvestmentAccount) => void;
  onDelete: (accountId: string) => void;
}

export function InvestmentAccountCard({
  account,
  onAddValuation,
  onViewHistory,
  onEdit,
  onDelete,
}: InvestmentAccountCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const typeLabel = account.investmentType
    ? INVESTMENT_TYPE_LABELS[account.investmentType as InvestmentType]
    : '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{account.name}</h3>
          <p className="text-sm text-gray-500">
            {account.provider}
            {typeLabel && ` · ${typeLabel}`}
          </p>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
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
              <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                <button
                  onClick={() => {
                    onEdit(account);
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDelete(account.id);
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

      {/* Value */}
      <div className="mb-4">
        {account.latestValuation ? (
          <>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(account.latestValuation.value)}
            </p>
            <p className="text-sm text-gray-500">
              as of {formatDate(account.latestValuation.date)}
            </p>
          </>
        ) : (
          <p className="text-gray-400 italic">No valuations yet</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onAddValuation(account.id)}
          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {account.latestValuation ? 'Add Valuation' : 'Add First Valuation'}
        </button>
        {account.latestValuation && (
          <button
            onClick={() => onViewHistory(account.id)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            View History
          </button>
        )}
      </div>
    </div>
  );
}
