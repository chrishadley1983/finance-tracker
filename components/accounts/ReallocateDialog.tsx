'use client';

import { useState } from 'react';
import type { AccountWithStats, Account } from '@/lib/types/account';
import { getAccountIcon, getAccountTypeLabel } from '@/lib/types/account';

interface ReallocateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAccount: AccountWithStats;
  availableAccounts: Account[];
  onConfirm: (targetAccountId: string) => Promise<void>;
  isLoading?: boolean;
}

export function ReallocateDialog({
  open,
  onOpenChange,
  sourceAccount,
  availableAccounts,
  onConfirm,
  isLoading = false,
}: ReallocateDialogProps) {
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Filter out source account and archived accounts
  const validTargets = availableAccounts.filter(
    (a) => a.id !== sourceAccount.id && !a.is_archived
  );

  const handleConfirm = async () => {
    setError(null);

    if (!targetAccountId) {
      setError('Please select a target account');
      return;
    }

    try {
      await onConfirm(targetAccountId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move transactions');
    }
  };

  const handleClose = () => {
    setTargetAccountId('');
    setError(null);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Move Transactions</h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Source account info */}
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="text-sm text-gray-500 mb-1">Moving from:</div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{getAccountIcon(sourceAccount.type, sourceAccount.icon)}</span>
              <div>
                <div className="font-medium text-gray-900">{sourceAccount.name}</div>
                <div className="text-sm text-gray-500">
                  {sourceAccount.transactionCount.toLocaleString()} transaction{sourceAccount.transactionCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Target account selector */}
          <div>
            <label htmlFor="targetAccount" className="block text-sm font-medium text-gray-700 mb-2">
              Move to:
            </label>
            {validTargets.length > 0 ? (
              <select
                id="targetAccount"
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an account...</option>
                {validTargets.map((account) => (
                  <option key={account.id} value={account.id}>
                    {getAccountIcon(account.type, account.icon)} {account.name} ({getAccountTypeLabel(account.type)})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
                No other active accounts available. Create a new account first.
              </div>
            )}
          </div>

          {/* Warning */}
          {targetAccountId && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-700">
                  All {sourceAccount.transactionCount.toLocaleString()} transactions will be moved to the selected account. This cannot be undone.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !targetAccountId || validTargets.length === 0}
          >
            {isLoading ? 'Moving...' : 'Move Transactions'}
          </button>
        </div>
      </div>
    </div>
  );
}
