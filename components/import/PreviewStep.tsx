'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ParsedTransaction, ImportFormat } from '@/lib/types/import';
import type { ColumnMapping } from '@/lib/validations/import';

interface PreviewResult {
  transactions: ParsedTransaction[];
  validation: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    errors: Array<{ row: number; errors: string[] }>;
    warnings: string[];
    dateRange: { earliest: string; latest: string } | null;
    totalCredits: number;
    totalDebits: number;
  };
}

interface Account {
  id: string;
  name: string;
  type: string;
}

// Account types that can have transactions
const TRANSACTION_ACCOUNT_TYPES = ['current', 'savings', 'credit'];

interface PreviewStepProps {
  sessionId: string;
  columnMapping: ColumnMapping;
  selectedFormat: ImportFormat | null;
  onComplete: (result: PreviewResult, accountId: string) => void;
  onBack: () => void;
}

export function PreviewStep({
  sessionId,
  columnMapping,
  selectedFormat,
  onComplete,
  onBack,
}: PreviewStepProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Fetch preview data and accounts
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch preview in parallel with accounts
        const [previewResponse, accountsResponse] = await Promise.all([
          fetch('/api/import/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              formatId: selectedFormat?.id,
              customMapping: selectedFormat ? undefined : columnMapping,
            }),
          }),
          fetch('/api/accounts'),
        ]);

        if (!previewResponse.ok) {
          const data = await previewResponse.json();
          throw new Error(data.error || 'Failed to generate preview');
        }

        const preview = await previewResponse.json();
        setPreviewData(preview);

        if (accountsResponse.ok) {
          const accountData = await accountsResponse.json();
          // Only show accounts that can have transactions
          const transactionAccounts = (accountData.accounts || []).filter(
            (account: Account) => TRANSACTION_ACCOUNT_TYPES.includes(account.type)
          );
          setAccounts(transactionAccounts);
          if (transactionAccounts.length === 1) {
            setSelectedAccountId(transactionAccounts[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [sessionId, columnMapping, selectedFormat]);

  const handleContinue = useCallback(() => {
    if (!previewData || !selectedAccountId) {
      setError('Please select an account');
      return;
    }
    onComplete(previewData, selectedAccountId);
  }, [previewData, selectedAccountId, onComplete]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="w-12 h-12 mx-auto mb-4">
          <svg
            className="animate-spin text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <p className="text-slate-600">Generating preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!previewData) return null;

  const { validation, transactions } = previewData;
  const displayTransactions = showAllTransactions
    ? transactions
    : transactions.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Preview Import</h2>
        <p className="text-slate-600">
          Review the parsed transactions before importing.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-600">Total Rows</p>
          <p className="text-2xl font-semibold text-slate-900">{validation.totalRows}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">Valid</p>
          <p className="text-2xl font-semibold text-green-700">{validation.validRows}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-600">Invalid</p>
          <p className="text-2xl font-semibold text-red-700">{validation.invalidRows}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">Net Total</p>
          <p className="text-2xl font-semibold text-blue-700">
            {formatCurrency(validation.totalCredits - validation.totalDebits)}
          </p>
        </div>
      </div>

      {/* Date Range & Totals */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate-600">Date Range: </span>
            <span className="font-medium text-slate-900">
              {validation.dateRange
                ? `${formatDate(validation.dateRange.earliest)} - ${formatDate(validation.dateRange.latest)}`
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-600">Total Credits: </span>
            <span className="font-medium text-green-600">
              {formatCurrency(validation.totalCredits)}
            </span>
          </div>
          <div>
            <span className="text-slate-600">Total Debits: </span>
            <span className="font-medium text-red-600">
              {formatCurrency(validation.totalDebits)}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Warnings</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            {validation.warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800 mb-2">
            Errors ({validation.errors.length} rows)
          </h3>
          <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
            {validation.errors.slice(0, 10).map((err, i) => (
              <li key={i}>
                Row {err.row}: {err.errors.join(', ')}
              </li>
            ))}
            {validation.errors.length > 10 && (
              <li className="italic">...and {validation.errors.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Account Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Import to Account <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select account --</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type})
            </option>
          ))}
        </select>
        {accounts.length === 0 && (
          <p className="text-sm text-slate-500 mt-1">
            No accounts found.{' '}
            <a href="/accounts" className="text-blue-600 hover:underline">
              Create an account
            </a>{' '}
            first.
          </p>
        )}
      </div>

      {/* Transaction Preview Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700">
            Transaction Preview ({transactions.length} transactions)
          </h3>
          {transactions.length > 10 && (
            <button
              onClick={() => setShowAllTransactions(!showAllTransactions)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showAllTransactions ? 'Show less' : `Show all ${transactions.length}`}
            </button>
          )}
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-600 font-medium">Date</th>
                  <th className="px-4 py-2 text-left text-slate-600 font-medium">Description</th>
                  <th className="px-4 py-2 text-right text-slate-600 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayTransactions.map((tx, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-4 py-2 text-slate-900 max-w-md truncate">
                      {tx.description}
                    </td>
                    <td
                      className={`px-4 py-2 text-right whitespace-nowrap font-medium ${
                        tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-200">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedAccountId || validation.validRows === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          Continue to Import
        </button>
      </div>
    </div>
  );
}
