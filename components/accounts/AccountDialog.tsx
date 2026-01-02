'use client';

import { useState, useEffect } from 'react';
import type { Account, AccountType, CreateAccountInput, UpdateAccountInput } from '@/lib/types/account';
import { accountTypeConfig } from '@/lib/types/account';

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  onSave: (data: CreateAccountInput | UpdateAccountInput) => Promise<void>;
  isLoading?: boolean;
}

const accountTypes: AccountType[] = [
  'current',
  'savings',
  'credit',
  'investment',
  'pension',
  'isa',
  'property',
  'other',
];

export function AccountDialog({
  open,
  onOpenChange,
  account,
  onSave,
  isLoading = false,
}: AccountDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('current');
  const [provider, setProvider] = useState('');
  const [notes, setNotes] = useState('');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!account;

  // Reset form when dialog opens/closes or account changes
  useEffect(() => {
    if (open) {
      if (account) {
        setName(account.name);
        setType(account.type);
        setProvider(account.provider || '');
        setNotes(account.notes || '');
        setIncludeInNetWorth(account.include_in_net_worth ?? true);
      } else {
        setName('');
        setType('current');
        setProvider('');
        setNotes('');
        setIncludeInNetWorth(true);
      }
      setError(null);
    }
  }, [open, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      if (isEditMode) {
        await onSave({
          name: name.trim(),
          type,
          provider: provider.trim() || undefined,
          notes: notes.trim() || undefined,
          include_in_net_worth: includeInNetWorth,
        } as UpdateAccountInput);
      } else {
        await onSave({
          name: name.trim(),
          type,
          provider: provider.trim() || undefined,
          notes: notes.trim() || undefined,
          include_in_net_worth: includeInNetWorth,
        } as CreateAccountInput);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditMode ? 'Edit Account' : 'Add Account'}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Main Current Account"
              maxLength={100}
              required
            />
          </div>

          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {accountTypes.map((t) => (
                <option key={t} value={t}>
                  {accountTypeConfig[t].icon} {accountTypeConfig[t].label}
                </option>
              ))}
            </select>
          </div>

          {/* Provider / Institution */}
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-1">
              Institution
            </label>
            <input
              type="text"
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., HSBC, Vanguard"
              maxLength={100}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optional notes about this account..."
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Include in Net Worth */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeInNetWorth"
              checked={includeInNetWorth}
              onChange={(e) => setIncludeInNetWorth(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="includeInNetWorth" className="text-sm text-gray-700">
              Include in net worth calculations
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
