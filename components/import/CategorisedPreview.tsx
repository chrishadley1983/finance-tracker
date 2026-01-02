'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CategoryCell } from './CategoryCell';
import { BulkCategorise } from './BulkCategorise';
import { BulkEditMode } from './BulkEditMode';
import { RuleSuggestionToast, useRuleSuggestions, type RuleSuggestionData } from './RuleSuggestion';
import type { ParsedTransaction, ImportFormat } from '@/lib/types/import';
import type { ColumnMapping } from '@/lib/validations/import';
import type { CategorisationResult, CategorisationStats } from '@/lib/categorisation';

// =============================================================================
// TYPES
// =============================================================================

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
  account_type: string;
}

interface Category {
  id: string;
  name: string;
  group_name: string;
}

type FilterMode = 'all' | 'categorised' | 'uncategorised' | 'low_confidence';

interface CategorisedPreviewProps {
  sessionId: string;
  columnMapping: ColumnMapping;
  selectedFormat: ImportFormat | null;
  onComplete: (result: PreviewResult, accountId: string, categoryOverrides: Map<number, { categoryId: string; categoryName: string }>) => void;
  onBack: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CategorisedPreview({
  sessionId,
  columnMapping,
  selectedFormat,
  onComplete,
  onBack,
}: CategorisedPreviewProps) {
  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Categorisation state
  const [isCategorising, setIsCategorising] = useState(false);
  const [categorisationProgress, setCategorisationProgress] = useState({ current: 0, total: 0 });
  const [categorisationResults, setCategorisationResults] = useState<Map<number, CategorisationResult>>(new Map());
  const [categorisationStats, setCategorisationStats] = useState<CategorisationStats | null>(null);
  const [categoryOverrides, setCategoryOverrides] = useState<Map<number, { categoryId: string; categoryName: string }>>(new Map());

  // UI state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Category learning - rule suggestions
  const {
    suggestions,
    acceptSuggestion,
    dismissSuggestion,
    dismissPatternPermanently,
    fetchSuggestions,
  } = useRuleSuggestions();

  // Track corrections for learning
  const pendingCorrections = useMemo(() => new Map<number, {
    description: string;
    originalCategoryId: string | null;
    originalSource: string | null;
  }>(), []);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  // Fetch preview data, accounts, and categories
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const [previewResponse, accountsResponse, categoriesResponse] = await Promise.all([
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
          fetch('/api/categories'),
        ]);

        if (!previewResponse.ok) {
          const data = await previewResponse.json();
          throw new Error(data.error || 'Failed to generate preview');
        }

        const preview = await previewResponse.json();
        setPreviewData(preview);

        if (accountsResponse.ok) {
          const accountData = await accountsResponse.json();
          setAccounts(accountData.data || []);
          if (accountData.data?.length === 1) {
            setSelectedAccountId(accountData.data[0].id);
          }
        }

        if (categoriesResponse.ok) {
          const categoryData = await categoriesResponse.json();
          setCategories(categoryData || []);
        }

        // Trigger categorisation after data loads
        if (preview.transactions.length > 0) {
          await runCategorisation(preview.transactions);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, columnMapping, selectedFormat]);

  // =============================================================================
  // CATEGORISATION
  // =============================================================================

  const runCategorisation = useCallback(async (transactions: ParsedTransaction[]) => {
    setIsCategorising(true);
    setCategorisationProgress({ current: 0, total: transactions.length });

    try {
      const response = await fetch('/api/import/categorise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transactions,
        }),
      });

      if (!response.ok) {
        throw new Error('Categorisation failed');
      }

      const data = await response.json();

      // Convert results array to map
      const resultsMap = new Map<number, CategorisationResult>();
      data.results.forEach((result: CategorisationResult, index: number) => {
        resultsMap.set(index, result);
      });

      setCategorisationResults(resultsMap);
      setCategorisationStats(data.stats);
      setCategorisationProgress({ current: transactions.length, total: transactions.length });
    } catch (err) {
      console.error('Categorisation error:', err);
      // Don't block preview on categorisation failure
    } finally {
      setIsCategorising(false);
    }
  }, [sessionId]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleCategoryChange = useCallback((rowIndex: number, categoryId: string, categoryName: string) => {
    // Get original categorisation result before override
    const originalResult = categorisationResults.get(rowIndex);
    const transaction = previewData?.transactions[rowIndex];

    // Track this as a correction if category changed from auto-categorised value
    if (transaction && originalResult && originalResult.categoryId !== categoryId) {
      pendingCorrections.set(rowIndex, {
        description: transaction.description,
        originalCategoryId: originalResult.categoryId,
        originalSource: originalResult.source,
      });

      // Record the correction in the background
      fetch('/api/categories/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: transaction.description,
          originalCategoryId: originalResult.categoryId,
          correctedCategoryId: categoryId,
          originalSource: originalResult.source,
          importSessionId: sessionId,
        }),
      }).then(() => {
        // After recording, check for new suggestions
        fetchSuggestions();
      }).catch((err) => {
        console.error('Failed to record correction:', err);
      });
    }

    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      next.set(rowIndex, { categoryId, categoryName });
      return next;
    });

    // Track recent categories
    setRecentCategories((prev) => {
      const filtered = prev.filter((id) => id !== categoryId);
      return [categoryId, ...filtered].slice(0, 5);
    });
  }, [categorisationResults, previewData, pendingCorrections, sessionId, fetchSuggestions]);

  const handleCopyFromAbove = useCallback((rowIndex: number) => {
    if (rowIndex === 0) return;

    const aboveResult = categoryOverrides.get(rowIndex - 1) ||
      (categorisationResults.get(rowIndex - 1)
        ? {
            categoryId: categorisationResults.get(rowIndex - 1)!.categoryId!,
            categoryName: categorisationResults.get(rowIndex - 1)!.categoryName!
          }
        : null);

    if (aboveResult?.categoryId) {
      handleCategoryChange(rowIndex, aboveResult.categoryId, aboveResult.categoryName);
    }
  }, [categorisationResults, categoryOverrides, handleCategoryChange]);

  const handleBulkAssign = useCallback((categoryId: string, categoryName: string) => {
    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      selectedRows.forEach((rowIndex) => {
        next.set(rowIndex, { categoryId, categoryName });
      });
      return next;
    });
    setSelectedRows(new Set());

    // Track recent categories
    setRecentCategories((prev) => {
      const filtered = prev.filter((id) => id !== categoryId);
      return [categoryId, ...filtered].slice(0, 5);
    });
  }, [selectedRows]);

  const handleSelectAll = useCallback(() => {
    if (!previewData) return;
    setSelectedRows(new Set(previewData.transactions.map((_, i) => i)));
  }, [previewData]);

  const handleSelectNone = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const handleSelectUncategorised = useCallback(() => {
    if (!previewData) return;
    const uncategorised = new Set<number>();
    previewData.transactions.forEach((_, i) => {
      const override = categoryOverrides.get(i);
      const result = categorisationResults.get(i);
      if (!override?.categoryId && !result?.categoryId) {
        uncategorised.add(i);
      }
    });
    setSelectedRows(uncategorised);
  }, [previewData, categoryOverrides, categorisationResults]);

  const handleSelectLowConfidence = useCallback(() => {
    if (!previewData) return;
    const lowConf = new Set<number>();
    previewData.transactions.forEach((_, i) => {
      const override = categoryOverrides.get(i);
      if (override) return; // User already overrode
      const result = categorisationResults.get(i);
      if (result && result.confidence < 0.5 && result.categoryId) {
        lowConf.add(i);
      }
    });
    setSelectedRows(lowConf);
  }, [previewData, categoryOverrides, categorisationResults]);

  const handleRecategorise = useCallback(async () => {
    if (!previewData || selectedRows.size === 0) return;

    const selectedTransactions = Array.from(selectedRows).map((i) => previewData.transactions[i]);

    setIsCategorising(true);
    setCategorisationProgress({ current: 0, total: selectedTransactions.length });

    try {
      const response = await fetch('/api/import/categorise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transactions: selectedTransactions,
        }),
      });

      if (!response.ok) {
        throw new Error('Re-categorisation failed');
      }

      const data = await response.json();

      // Update results for selected rows
      const selectedIndices = Array.from(selectedRows);
      setCategorisationResults((prev) => {
        const next = new Map(prev);
        data.results.forEach((result: CategorisationResult, i: number) => {
          next.set(selectedIndices[i], result);
        });
        return next;
      });

      // Clear overrides for re-categorised rows
      setCategoryOverrides((prev) => {
        const next = new Map(prev);
        selectedRows.forEach((i) => next.delete(i));
        return next;
      });

      setSelectedRows(new Set());
    } catch (err) {
      console.error('Re-categorisation error:', err);
    } finally {
      setIsCategorising(false);
    }
  }, [previewData, selectedRows, sessionId]);

  const handleRowSelect = useCallback((rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  }, []);

  const handleContinue = useCallback(() => {
    if (!previewData || !selectedAccountId) {
      setError('Please select an account');
      return;
    }
    onComplete(previewData, selectedAccountId, categoryOverrides);
  }, [previewData, selectedAccountId, categoryOverrides, onComplete]);

  // Edit mode handlers
  const handleTransactionsChange = useCallback((newTransactions: ParsedTransaction[]) => {
    if (!previewData) return;
    setPreviewData({
      ...previewData,
      transactions: newTransactions,
      validation: {
        ...previewData.validation,
        totalRows: newTransactions.length,
        validRows: newTransactions.length,
      },
    });
  }, [previewData]);

  const handleCategoryOverridesChange = useCallback((newOverrides: Map<number, { categoryId: string; categoryName: string }>) => {
    setCategoryOverrides(newOverrides);
  }, []);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  // Get effective result (override or auto)
  const getEffectiveResult = useCallback((rowIndex: number): CategorisationResult => {
    const override = categoryOverrides.get(rowIndex);
    if (override) {
      return {
        categoryId: override.categoryId,
        categoryName: override.categoryName,
        source: 'rule_exact' as const, // Treat overrides as high confidence
        confidence: 1.0,
        matchDetails: 'Manually assigned',
      };
    }
    return categorisationResults.get(rowIndex) || {
      categoryId: null,
      categoryName: null,
      source: 'none' as const,
      confidence: 0,
      matchDetails: 'Not categorised',
    };
  }, [categoryOverrides, categorisationResults]);

  // Count statistics including overrides
  const effectiveStats = useMemo(() => {
    if (!previewData) return null;

    let categorised = 0;
    let uncategorised = 0;
    let lowConfidence = 0;

    previewData.transactions.forEach((_, i) => {
      const result = getEffectiveResult(i);
      if (result.categoryId) {
        categorised++;
        if (result.confidence < 0.5 && !categoryOverrides.has(i)) {
          lowConfidence++;
        }
      } else {
        uncategorised++;
      }
    });

    return { categorised, uncategorised, lowConfidence };
  }, [previewData, getEffectiveResult, categoryOverrides]);

  // Filter transactions based on filter mode
  const filteredTransactions = useMemo(() => {
    if (!previewData) return [];

    return previewData.transactions.filter((_, i) => {
      const result = getEffectiveResult(i);
      switch (filterMode) {
        case 'categorised':
          return !!result.categoryId;
        case 'uncategorised':
          return !result.categoryId;
        case 'low_confidence':
          return result.categoryId && result.confidence < 0.5 && !categoryOverrides.has(i);
        default:
          return true;
      }
    });
  }, [previewData, filterMode, getEffectiveResult, categoryOverrides]);

  const displayTransactions = showAllTransactions
    ? filteredTransactions
    : filteredTransactions.slice(0, 10);

  // =============================================================================
  // HELPERS
  // =============================================================================

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

  // =============================================================================
  // RENDER
  // =============================================================================

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Preview Import</h2>
        <p className="text-slate-600">
          Review the parsed transactions and their suggested categories before importing.
        </p>
      </div>

      {/* Categorisation Progress */}
      {isCategorising && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-blue-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-blue-700">
              Categorising transactions... {categorisationProgress.current}/{categorisationProgress.total}
            </span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-600">Total Rows</p>
          <p className="text-2xl font-semibold text-slate-900">{validation.totalRows}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">Categorised</p>
          <p className="text-2xl font-semibold text-green-700">
            {effectiveStats?.categorised ?? categorisationStats?.categorised ?? 0}
          </p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm text-yellow-600">Need Review</p>
          <p className="text-2xl font-semibold text-yellow-700">
            {effectiveStats?.uncategorised ?? categorisationStats?.uncategorised ?? 0}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-600">Low Confidence</p>
          <p className="text-2xl font-semibold text-red-700">
            {effectiveStats?.lowConfidence ?? categorisationStats?.lowConfidence ?? 0}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600">Net Total</p>
          <p className="text-2xl font-semibold text-blue-700">
            {formatCurrency(validation.totalCredits - validation.totalDebits)}
          </p>
        </div>
      </div>

      {/* Bulk Categorise Toolbar */}
      <BulkCategorise
        selectedCount={selectedRows.size}
        totalCount={transactions.length}
        uncategorisedCount={effectiveStats?.uncategorised ?? 0}
        lowConfidenceCount={effectiveStats?.lowConfidence ?? 0}
        categories={categories}
        onBulkAssign={handleBulkAssign}
        onSelectAll={handleSelectAll}
        onSelectNone={handleSelectNone}
        onSelectUncategorised={handleSelectUncategorised}
        onSelectLowConfidence={handleSelectLowConfidence}
        onRecategorise={handleRecategorise}
        isRecategorising={isCategorising}
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { mode: 'all' as FilterMode, label: 'All', count: transactions.length },
          { mode: 'categorised' as FilterMode, label: 'Categorised', count: effectiveStats?.categorised ?? 0 },
          { mode: 'uncategorised' as FilterMode, label: 'Uncategorised', count: effectiveStats?.uncategorised ?? 0 },
          { mode: 'low_confidence' as FilterMode, label: 'Low Confidence', count: effectiveStats?.lowConfidence ?? 0 },
        ].map(({ mode, label, count }) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filterMode === mode
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

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
              {account.name} ({account.account_type})
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

      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          Transaction Preview ({filteredTransactions.length} transactions)
        </h3>
        <div className="flex items-center gap-3">
          {filteredTransactions.length > 10 && !isEditMode && (
            <button
              onClick={() => setShowAllTransactions(!showAllTransactions)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showAllTransactions ? 'Show less' : `Show all ${filteredTransactions.length}`}
            </button>
          )}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`text-sm px-3 py-1.5 rounded flex items-center gap-2 transition-colors ${
              isEditMode
                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
          </button>
        </div>
      </div>

      {/* Edit Mode or Preview Table */}
      {isEditMode ? (
        <BulkEditMode
          transactions={transactions}
          categorisationResults={categorisationResults}
          categoryOverrides={categoryOverrides}
          categories={categories}
          onTransactionsChange={handleTransactionsChange}
          onCategoryOverridesChange={handleCategoryOverridesChange}
          onExit={() => setIsEditMode(false)}
        />
      ) : (
      /* Transaction Preview Table */
      <div>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === transactions.length && transactions.length > 0}
                      onChange={(e) => e.target.checked ? handleSelectAll() : handleSelectNone()}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-slate-600 font-medium">Date</th>
                  <th className="px-4 py-2 text-left text-slate-600 font-medium">Description</th>
                  <th className="px-4 py-2 text-right text-slate-600 font-medium">Amount</th>
                  <th className="px-4 py-2 text-left text-slate-600 font-medium">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayTransactions.map((tx) => {
                  // Find original index
                  const originalIndex = transactions.findIndex((t) => t === tx);
                  const result = getEffectiveResult(originalIndex);
                  const isSelected = selectedRows.has(originalIndex);

                  return (
                    <tr
                      key={originalIndex}
                      className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowSelect(originalIndex)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-2 text-slate-900 max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td
                        className={`px-4 py-2 text-right whitespace-nowrap font-medium ${
                          tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-2">
                        <CategoryCell
                          result={result}
                          categories={categories}
                          recentCategories={recentCategories}
                          onCategoryChange={(catId, catName) => handleCategoryChange(originalIndex, catId, catName)}
                          onCopyFromAbove={originalIndex > 0 ? () => handleCopyFromAbove(originalIndex) : undefined}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

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

      {/* Rule Suggestion Toast */}
      <RuleSuggestionToast
        suggestions={suggestions}
        onAccept={acceptSuggestion}
        onDismiss={dismissSuggestion}
        onNeverAskForPattern={dismissPatternPermanently}
      />
    </div>
  );
}
