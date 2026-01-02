'use client';

import { useState, useCallback } from 'react';
import type { ParsedTransaction, DuplicateMatchType } from '@/lib/types/import';

interface DuplicateResult {
  importRow: number;
  importTransaction: ParsedTransaction;
  existingTransaction: {
    id: string;
    date: string;
    amount: number;
    description: string;
    account_id: string;
  };
  matchType: DuplicateMatchType;
  similarity: number;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  importSessionId: string;
}

interface ImportStepProps {
  sessionId: string;
  transactions: ParsedTransaction[];
  accountId: string;
  onComplete: (result: ImportResult) => void;
  onBack: () => void;
}

type DuplicateStrategy = 'strict' | 'fuzzy' | 'dateRange';

export function ImportStep({
  sessionId,
  transactions,
  accountId,
  onComplete,
  onBack,
}: ImportStepProps) {
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateResult[] | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('strict');
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  const checkDuplicates = useCallback(async () => {
    setIsCheckingDuplicates(true);
    setError(null);

    try {
      const response = await fetch('/api/import/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transactions,
          strategy: duplicateStrategy,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to check duplicates');
      }

      const data = await response.json();
      setDuplicates(data.duplicates);
      // Default to skipping all duplicates
      setSelectedDuplicates(new Set(data.duplicates.map((d: DuplicateResult) => d.importRow)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check duplicates');
    } finally {
      setIsCheckingDuplicates(false);
    }
  }, [sessionId, transactions, duplicateStrategy]);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    setError(null);
    setImportProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 5, 90));
      }, 100);

      const response = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transactions,
          accountId,
          skipDuplicates,
          duplicateRowsToSkip: Array.from(selectedDuplicates),
        }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import transactions');
      }

      const result = await response.json();
      onComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions');
      setImportProgress(0);
    } finally {
      setIsImporting(false);
    }
  }, [sessionId, transactions, accountId, skipDuplicates, selectedDuplicates, onComplete]);

  const toggleDuplicate = (rowNumber: number) => {
    setSelectedDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

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

  const getMatchTypeColor = (matchType: DuplicateMatchType) => {
    switch (matchType) {
      case 'exact':
        return 'bg-red-100 text-red-800';
      case 'likely':
        return 'bg-yellow-100 text-yellow-800';
      case 'possible':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Import Transactions</h2>
        <p className="text-slate-600">
          Check for duplicates and import {transactions.length} transactions.
        </p>
      </div>

      {/* Duplicate Detection Options */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-medium text-slate-900">Duplicate Detection</h3>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="skipDuplicates"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="skipDuplicates" className="text-sm text-slate-700">
            Skip duplicate transactions
          </label>
        </div>

        {skipDuplicates && (
          <div className="space-y-2">
            <label className="block text-sm text-slate-700">Detection Strategy</label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: 'strict' as const, label: 'Strict', desc: 'Exact date, amount, description' },
                { value: 'fuzzy' as const, label: 'Fuzzy', desc: 'Same date, similar amount/description' },
                { value: 'dateRange' as const, label: 'Date Range', desc: 'Same amount within ±1 day' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`
                    flex-1 min-w-[140px] p-3 border rounded-lg cursor-pointer transition-colors
                    ${duplicateStrategy === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={option.value}
                    checked={duplicateStrategy === option.value}
                    onChange={() => setDuplicateStrategy(option.value)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium text-slate-900">
                    {option.label}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {option.desc}
                  </span>
                </label>
              ))}
            </div>

            <button
              onClick={checkDuplicates}
              disabled={isCheckingDuplicates}
              className="mt-3 px-4 py-2 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50 transition-colors"
            >
              {isCheckingDuplicates ? 'Checking...' : 'Check for Duplicates'}
            </button>
          </div>
        )}
      </div>

      {/* Duplicate Results */}
      {duplicates !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900">
              Found {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''}
            </h3>
            {duplicates.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDuplicates(new Set(duplicates.map((d) => d.importRow)))}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Skip all
                </button>
                <button
                  onClick={() => setSelectedDuplicates(new Set())}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Import all
                </button>
              </div>
            )}
          </div>

          {duplicates.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">No duplicates found. Ready to import!</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-8">
                      <span className="sr-only">Skip</span>
                    </th>
                    <th className="px-3 py-2 text-left text-slate-600 font-medium">New Transaction</th>
                    <th className="px-3 py-2 text-left text-slate-600 font-medium">Existing</th>
                    <th className="px-3 py-2 text-left text-slate-600 font-medium">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {duplicates.map((dup) => (
                    <tr key={dup.importRow} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedDuplicates.has(dup.importRow)}
                          onChange={() => toggleDuplicate(dup.importRow)}
                          title={selectedDuplicates.has(dup.importRow) ? 'Will skip' : 'Will import'}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-slate-900 truncate max-w-[200px]">
                          {dup.importTransaction.description}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDate(dup.importTransaction.date)} •{' '}
                          {formatCurrency(dup.importTransaction.amount)}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-slate-900 truncate max-w-[200px]">
                          {dup.existingTransaction.description}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDate(dup.existingTransaction.date)} •{' '}
                          {formatCurrency(dup.existingTransaction.amount)}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getMatchTypeColor(
                            dup.matchType
                          )}`}
                        >
                          {dup.matchType}
                        </span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {Math.round(dup.similarity * 100)}% match
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Checked rows will be skipped during import. Uncheck to import anyway.
          </p>
        </div>
      )}

      {/* Import Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Import Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold text-blue-900">{transactions.length}</p>
            <p className="text-xs text-blue-700">Total</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-green-600">
              {transactions.length - selectedDuplicates.size}
            </p>
            <p className="text-xs text-green-700">To Import</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-600">{selectedDuplicates.size}</p>
            <p className="text-xs text-slate-500">To Skip</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Import Progress */}
      {isImporting && (
        <div className="space-y-2">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-200"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-sm text-slate-600 text-center">Importing transactions...</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-200">
        <button
          onClick={onBack}
          disabled={isImporting}
          className="px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleImport}
          disabled={isImporting || isCheckingDuplicates}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors"
        >
          {isImporting ? 'Importing...' : `Import ${transactions.length - selectedDuplicates.size} Transactions`}
        </button>
      </div>
    </div>
  );
}
