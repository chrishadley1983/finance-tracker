'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CategoryCell } from './CategoryCell';
import { BulkCategorise } from './BulkCategorise';
import { BulkEditMode } from './BulkEditMode';
import { RuleSuggestionToast, useRuleSuggestions, type RuleSuggestionData } from './RuleSuggestion';
import type { ParsedTransaction, ImportFormat } from '@/lib/types/import';
import type { ColumnMapping } from '@/lib/validations/import';
import type { CategorisationResult, CategorisationStats } from '@/lib/categorisation';
import { formatDateGB, formatGBP } from '@/lib/format';
import { isUnsure } from '@/lib/review/queue';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Notice, SkeletonRows } from '@/components/ui/Notice';
import { Tabs } from '@/components/ui/Tabs';
import { formatAmount } from '@/components/transactions/TransactionTable';

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
  type: string;
}

// Account types that can have transactions imported
const TRANSACTION_ACCOUNT_TYPES = ['current', 'savings', 'credit'];

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
          // Only show accounts that can have transactions imported
          const transactionAccounts = (accountData.accounts || []).filter(
            (account: Account) => TRANSACTION_ACCOUNT_TYPES.includes(account.type)
          );
          setAccounts(transactionAccounts);
          if (transactionAccounts.length === 1) {
            setSelectedAccountId(transactionAccounts[0].id);
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
      if (result && isUnsure(result.confidence) && result.categoryId) {
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

    // Merge categorisation data into transactions before completing
    const transactionsWithCategories = previewData.transactions.map((tx, index) => {
      // Check for manual override first
      const override = categoryOverrides.get(index);
      if (override) {
        return {
          ...tx,
          categoryId: override.categoryId,
          categoryName: override.categoryName,
          categorisationSource: 'manual' as const,
          categorisationConfidence: 1.0,
        };
      }

      // Check for auto-categorisation result
      const result = categorisationResults.get(index);
      if (result?.categoryId) {
        return {
          ...tx,
          categoryId: result.categoryId,
          categoryName: result.categoryName,
          categorisationSource: result.source,
          categorisationConfidence: result.confidence,
          needsReview: result.needsReview,
        };
      }

      return tx;
    });

    const updatedPreviewData = {
      ...previewData,
      transactions: transactionsWithCategories,
    };

    onComplete(updatedPreviewData, selectedAccountId, categoryOverrides);
  }, [previewData, selectedAccountId, categoryOverrides, categorisationResults, onComplete]);

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
        if (isUnsure(result.confidence) && !categoryOverrides.has(i)) {
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
          return result.categoryId && isUnsure(result.confidence) && !categoryOverrides.has(i);
        default:
          return true;
      }
    });
  }, [previewData, filterMode, getEffectiveResult, categoryOverrides]);

  const displayTransactions = showAllTransactions
    ? filteredTransactions
    : filteredTransactions.slice(0, 10);

  // =============================================================================
  // RENDER
  // =============================================================================

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-ink-2" role="status">
          Reading the rows and suggesting categories...
        </p>
        <SkeletonRows rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-5">
        <Notice tone="error">{error}</Notice>
        <div className="flex justify-between border-t border-line pt-4">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (!previewData) return null;

  const { validation, transactions } = previewData;
  const stats = {
    categorised: effectiveStats?.categorised ?? categorisationStats?.categorised ?? 0,
    uncategorised: effectiveStats?.uncategorised ?? categorisationStats?.uncategorised ?? 0,
    unsure: effectiveStats?.lowConfidence ?? categorisationStats?.lowConfidence ?? 0,
  };
  const net = validation.totalCredits - validation.totalDebits;
  const filterTabs = [
    { id: 'all' as FilterMode, label: `All ${transactions.length}` },
    { id: 'categorised' as FilterMode, label: `Categorised ${stats.categorised}` },
    { id: 'uncategorised' as FilterMode, label: `No category ${stats.uncategorised}` },
    { id: 'low_confidence' as FilterMode, label: `Unsure ${stats.unsure}` },
  ];
  const allSelected = selectedRows.size === transactions.length && transactions.length > 0;
  const someSelected = selectedRows.size > 0 && !allSelected;
  const COLS =
    'grid-cols-[1.75rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_6.5rem_minmax(0,1fr)_minmax(9rem,13rem)_7.5rem]';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold text-ink">Check and categorise</h2>
        <p className="text-sm text-ink-2" data-testid="preview-summary">
          <span className="fig text-ink">{validation.totalRows}</span> rows
          {validation.dateRange && (
            <>
              {' '}
              from {formatDateGB(validation.dateRange.earliest)} to {formatDateGB(validation.dateRange.latest)}
            </>
          )}
          , net{' '}
          <span className={`fig whitespace-nowrap ${net > 0 ? 'text-in' : 'text-ink'}`}>{formatGBP(net, { pence: true, signed: true })}</span>.{' '}
          {stats.uncategorised === 0 && stats.unsure === 0
            ? 'Every row has a confident category.'
            : `${stats.categorised} categorised, ${stats.uncategorised} without a category${stats.unsure > 0 ? `, ${stats.unsure} unsure` : ''}.`}
        </p>
      </div>

      {isCategorising && (
        <Notice tone="info">
          Suggesting categories...{' '}
          <span className="fig">
            {categorisationProgress.current}/{categorisationProgress.total}
          </span>
        </Notice>
      )}

      {validation.invalidRows > 0 && (
        <Notice tone="warn">
          {validation.invalidRows} row{validation.invalidRows === 1 ? '' : 's'} could not be read and will be left out.
        </Notice>
      )}

      <div className="grid gap-1 sm:max-w-md">
        <Field label="Import into account" htmlFor="import-account">
          <Select id="import-account" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
            <option value="">Choose an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.type})
              </option>
            ))}
          </Select>
        </Field>
        {accounts.length === 0 && (
          <p className="text-xs text-ink-3">
            No accounts yet.{' '}
            <a href="/accounts" className="text-accent underline underline-offset-2">
              Create an account
            </a>{' '}
            first.
          </p>
        )}
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs tabs={filterTabs} active={filterMode} onChange={setFilterMode} label="Filter rows" />
        <div className="flex items-center gap-2">
          {filteredTransactions.length > 10 && !isEditMode && (
            <Button size="sm" variant="ghost" onClick={() => setShowAllTransactions(!showAllTransactions)}>
              {showAllTransactions ? 'Show first 10' : `Show all ${filteredTransactions.length}`}
            </Button>
          )}
          <Button size="sm" onClick={() => setIsEditMode(!isEditMode)} aria-pressed={isEditMode}>
            {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
          </Button>
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
        <div role="table" aria-label="Rows to import" className="rounded-md border border-line bg-surface">
          <div role="rowgroup">
            <div
              role="row"
              className={`grid ${COLS} items-center gap-x-3 rounded-t-md border-b border-line bg-sunk px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-3`}
            >
              <div role="columnheader" className="flex items-center">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => (e.target.checked ? handleSelectAll() : handleSelectNone())}
                  className="h-4 w-4 accent-accent"
                />
              </div>
              <div role="columnheader" className="hidden md:block">
                Date
              </div>
              <div role="columnheader">Description</div>
              <div role="columnheader" className="hidden md:block">
                Category
              </div>
              <div role="columnheader" className="text-right">
                Amount
              </div>
            </div>
          </div>
          <div role="rowgroup">
            {displayTransactions.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-ink-3">No rows match this filter.</div>
            )}
            {displayTransactions.map((tx) => {
              const originalIndex = transactions.findIndex((t) => t === tx);
              const result = getEffectiveResult(originalIndex);
              const isSelected = selectedRows.has(originalIndex);
              const cell = (
                <CategoryCell
                  result={result}
                  categories={categories}
                  recentCategories={recentCategories}
                  onCategoryChange={(catId, catName) => handleCategoryChange(originalIndex, catId, catName)}
                  onCopyFromAbove={originalIndex > 0 ? () => handleCopyFromAbove(originalIndex) : undefined}
                />
              );
              return (
                <div
                  key={originalIndex}
                  role="row"
                  aria-selected={isSelected}
                  className={`grid ${COLS} items-center gap-x-3 border-b border-line-2 px-3 py-2 text-sm last:border-b-0 ${
                    isSelected ? 'bg-sel' : 'hover:bg-sunk'
                  }`}
                >
                  <div role="cell" className="flex items-center">
                    <input
                      type="checkbox"
                      aria-label={`Select ${tx.description}`}
                      checked={isSelected}
                      onChange={() => handleRowSelect(originalIndex)}
                      className="h-4 w-4 accent-accent"
                    />
                  </div>
                  <div role="cell" className="hidden whitespace-nowrap text-ink-2 md:block" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDateGB(tx.date)}
                  </div>
                  <div role="cell" className="min-w-0">
                    <span className="block truncate text-ink" title={tx.description}>
                      {tx.description}
                    </span>
                    <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-ink-3 md:hidden">
                      <span className="shrink-0">{formatDateGB(tx.date)}</span>
                      <div className="min-w-0 flex-1">{cell}</div>
                    </div>
                  </div>
                  <div role="cell" className="hidden min-w-0 md:block">
                    {cell}
                  </div>
                  <div role="cell" className={`fig whitespace-nowrap text-right ${tx.amount > 0 ? 'text-in' : 'text-ink'}`}>
                    {formatAmount(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation (Edit Mode has its own Apply / Cancel) */}
      {!isEditMode && (
        <div className="flex justify-between gap-3 border-t border-line pt-4">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button variant="primary" onClick={handleContinue} disabled={!selectedAccountId || validation.validRows === 0}>
            Continue to Import
          </Button>
        </div>
      )}

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
