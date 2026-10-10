'use client';

import { useState, useCallback } from 'react';
import type { ParsedTransaction, DuplicateMatchType } from '@/lib/types/import';
import { formatDateGB } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { formatAmount } from '@/lib/format';

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

      // Transactions already have category data merged from CategorisedPreview
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

  const toImport = transactions.length - selectedDuplicates.size;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold text-ink">Import</h2>
        <p className="text-sm text-ink-2">
          Ready to import <span className="fig text-ink">{toImport}</span> of{' '}
          <span className="fig text-ink">{transactions.length}</span> transactions
          {selectedDuplicates.size > 0 && (
            <>
              , skipping <span className="fig text-ink">{selectedDuplicates.size}</span> duplicate
              {selectedDuplicates.size === 1 ? '' : 's'}
            </>
          )}
          .
        </p>
      </div>

      {/* Duplicate Detection Options */}
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-[13px] font-semibold text-ink">Duplicates</legend>
        <label htmlFor="skipDuplicates" className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            id="skipDuplicates"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Skip duplicate transactions
        </label>

        {skipDuplicates && (
          <>
            <div role="radiogroup" aria-label="How to match duplicates" className="grid gap-2 sm:grid-cols-3">
              {[
                { value: 'strict' as const, label: 'Strict', desc: 'Exact date, amount and description' },
                { value: 'fuzzy' as const, label: 'Fuzzy', desc: 'Same date, similar amount or description' },
                { value: 'dateRange' as const, label: 'Date range', desc: 'Same amount within a day either side' },
              ].map((option) => (
                <label
                  key={option.value}
                  className="cursor-pointer rounded-md border border-line bg-surface px-3 py-2 hover:bg-sunk has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={option.value}
                    checked={duplicateStrategy === option.value}
                    onChange={() => setDuplicateStrategy(option.value)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium text-ink">{option.label}</span>
                  <span className="block text-xs text-ink-3">{option.desc}</span>
                </label>
              ))}
            </div>
            <div>
              <Button size="sm" onClick={checkDuplicates} loading={isCheckingDuplicates}>
                {isCheckingDuplicates ? 'Checking...' : 'Check for Duplicates'}
              </Button>
            </div>
          </>
        )}
      </fieldset>

      {/* Duplicate Results */}
      {duplicates !== null && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-ink">
              Found {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''}
            </h3>
            {duplicates.length > 0 && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setSelectedDuplicates(new Set(duplicates.map((d) => d.importRow)))}>
                  Skip all
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedDuplicates(new Set())}>
                  Import all
                </Button>
              </div>
            )}
          </div>

          {duplicates.length === 0 ? (
            <Notice tone="success">No duplicates found. Ready to import.</Notice>
          ) : (
            <div role="table" aria-label="Possible duplicates" className="max-h-80 overflow-y-auto rounded-md border border-line bg-surface">
              <div
                role="row"
                className="sticky top-0 hidden grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_6rem] gap-x-3 border-b border-line bg-sunk px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-3 md:grid"
              >
                <span role="columnheader">
                  <span className="sr-only">Skip</span>
                </span>
                <span role="columnheader">New</span>
                <span role="columnheader">Already in your data</span>
                <span role="columnheader">Match</span>
              </div>
              {duplicates.map((dup) => {
                const skip = selectedDuplicates.has(dup.importRow);
                return (
                  <div
                    key={dup.importRow}
                    role="row"
                    className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-line-2 px-3 py-2 text-sm last:border-b-0 md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_6rem] ${
                      skip ? '' : 'bg-sel'
                    }`}
                  >
                    <span role="cell" className="row-span-2 pt-0.5 md:row-span-1">
                      <input
                        type="checkbox"
                        checked={skip}
                        onChange={() => toggleDuplicate(dup.importRow)}
                        aria-label={`Skip ${dup.importTransaction.description}`}
                        title={skip ? 'Will skip' : 'Will import'}
                        className="h-4 w-4 accent-accent"
                      />
                    </span>
                    <DupSide label="New" tx={dup.importTransaction} />
                    <span role="cell" className="text-right md:order-last md:text-left">
                      <Chip tone={dup.matchType === 'exact' ? 'bad' : dup.matchType === 'likely' ? 'warn' : 'neutral'}>{dup.matchType}</Chip>
                    </span>
                    <DupSide label="Existing" tx={dup.existingTransaction} className="col-start-2 col-end-4 md:col-auto" />
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-ink-3">Ticked rows are skipped. Untick a row to import it anyway.</p>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {/* Import Progress */}
      {isImporting && (
        <div className="grid gap-1.5" role="status">
          <div className="h-1.5 overflow-hidden rounded-full bg-line-2">
            <div className="h-full bg-accent transition-all duration-200" style={{ width: `${importProgress}%` }} />
          </div>
          <p className="text-sm text-ink-2">Importing transactions...</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-3 border-t border-line pt-4">
        <Button variant="ghost" onClick={onBack} disabled={isImporting}>
          Back
        </Button>
        <Button variant="primary" onClick={handleImport} loading={isImporting} disabled={isCheckingDuplicates}>
          {isImporting ? 'Importing...' : `Import ${toImport} Transactions`}
        </Button>
      </div>
    </div>
  );
}

function DupSide({
  label,
  tx,
  className = '',
}: {
  label: string;
  tx: { date: string; amount: number; description: string };
  className?: string;
}) {
  return (
    <span role="cell" className={`min-w-0 ${className}`}>
      <span className="block truncate text-ink" title={tx.description}>
        <span className="text-ink-3 md:hidden">{label}: </span>
        {tx.description}
      </span>
      <span className="block text-xs text-ink-3">
        {formatDateGB(tx.date)} ·{' '}
        <span className={`fig ${tx.amount > 0 ? 'text-in' : ''}`}>{formatAmount(tx.amount)}</span>
      </span>
    </span>
  );
}
