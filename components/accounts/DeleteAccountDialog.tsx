'use client';

import { useState } from 'react';
import type { AccountWithStats } from '@/lib/types/account';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountWithStats;
  onConfirm: (force: boolean) => Promise<void>;
  onReallocate: () => void;
  isLoading?: boolean;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  account,
  onConfirm,
  onReallocate,
  isLoading = false,
}: DeleteAccountDialogProps) {
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasTransactions = account.transactionCount > 0;
  const canDelete = !hasTransactions || confirmName === account.name;

  const handleDelete = async () => {
    setError(null);

    if (hasTransactions && confirmName !== account.name) {
      setError('Please type the account name to confirm');
      return;
    }

    try {
      await onConfirm(hasTransactions);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  };

  const handleClose = () => {
    setConfirmName('');
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
          <h2 className="text-lg font-semibold text-gray-900">Delete Account</h2>
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

          {hasTransactions ? (
            <>
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      This account has {account.transactionCount.toLocaleString()} transaction{account.transactionCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      You can move these transactions to another account before deleting, or delete everything.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 1: Reallocate */}
              <button
                onClick={() => {
                  handleClose();
                  onReallocate();
                }}
                className="w-full mb-3 px-4 py-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">Move transactions first</div>
                <div className="text-sm text-gray-500 mt-1">
                  Move all transactions to another account, then delete this one
                </div>
              </button>

              {/* Option 2: Force delete */}
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="font-medium text-red-800 mb-2">
                  Delete account and all {account.transactionCount.toLocaleString()} transactions
                </div>
                <p className="text-sm text-red-700 mb-3">
                  This action cannot be undone. Type <strong>{account.name}</strong> to confirm.
                </p>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Type account name to confirm"
                />
              </div>
            </>
          ) : (
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{account.name}</strong>? This action cannot be undone.
            </p>
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
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !canDelete}
          >
            {isLoading ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
