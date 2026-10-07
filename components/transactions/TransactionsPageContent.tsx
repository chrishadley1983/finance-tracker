'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { TransactionFilters, TRANSACTION_ACCOUNT_TYPES } from './TransactionFilters';
import { TransactionTable, type TransactionWithRunningBalance } from './TransactionTable';
import { TransactionPagination } from './TransactionPagination';
import { TransactionPanel, readError, ruleToast } from './TransactionPanel';
import { TransactionBulkBar } from './TransactionBulkBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useCategories } from '@/lib/hooks/useCategories';
import { useAccounts } from '@/lib/hooks/useAccounts';
import { SyncButton } from '@/components/bank-sync';
import {
  useTransactions,
  filterQueryParams,
  FilterState,
  TransactionWithRelations,
} from '@/lib/hooks/useTransactions';
import { filtersFromSearchParams, filtersToQueryString } from '@/lib/transactions/url-filters';
import { merchantKey } from '@/lib/categorisation/normalise';
import { formatGBP } from '@/lib/format';

/** What the bulk bar needs to know about a selected row (even off-page). */
interface SelectionMeta {
  amount: number;
  description: string;
  needs_review: boolean;
  category_id: string | null;
}

/** Previous values returned by PUT /api/transactions/bulk, for Undo. */
interface PreviousValues {
  id: string;
  is_validated: boolean;
  needs_review: boolean;
  account_id: string;
}

type UndoField = 'is_validated' | 'needs_review' | 'account_id';

const ANSWER_CHUNK = 500; // POST /api/categorisation/answers: ids per answer

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`;
}

export function TransactionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // Filters are seeded from, and written back to, the URL.
  const [filters, setFilters] = useState<FilterState>(() => filtersFromSearchParams(searchParams));
  const lastQueryString = useRef(filtersToQueryString(filters));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const qs = filtersToQueryString(filters);
    if (qs === lastQueryString.current) return;
    lastQueryString.current = qs;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

  // The URL changed from outside (back/forward, a link to /transactions?…).
  useEffect(() => {
    const next = filtersFromSearchParams(searchParams);
    const qs = filtersToQueryString(next);
    if (qs === lastQueryString.current) return;
    lastQueryString.current = qs;
    setFilters(next);
    setPage(1);
  }, [searchParams]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMeta, setSelectionMeta] = useState<Map<string, SelectionMeta>>(() => new Map());
  const [allMatching, setAllMatching] = useState<{ total: number; capped: boolean } | null>(null);
  const [loadingAllIds, setLoadingAllIds] = useState(false);

  const { data: categoryData } = useCategories();
  const { data: accountData } = useAccounts();
  const moveTargets = useMemo(
    () =>
      (accountData ?? [])
        .filter((a) => TRANSACTION_ACCOUNT_TYPES.includes(a.type))
        .map((a) => ({ id: a.id, name: a.name })),
    [accountData]
  );

  // Panel (view/edit or add)
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTransaction, setPanelTransaction] = useState<TransactionWithRelations | null>(null);

  // Confirm dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionWithRelations | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Loading states for operations
  const [isOperating, setIsOperating] = useState(false);

  // Running-balance mode: filtered to exactly one account and nothing else.
  const isSingleAccountFilter = Boolean(
    filters.accountId &&
    !filters.categoryId &&
    !filters.search &&
    !filters.dateFrom &&
    !filters.dateTo &&
    !filters.status &&
    (!filters.validated || filters.validated === 'all')
  );

  // State for account-specific transactions with running balance
  const [accountTransactions, setAccountTransactions] = useState<TransactionWithRunningBalance[]>([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountIsLoading, setAccountIsLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Regular transactions hook (also supplies the header totals in account mode)
  const {
    transactions: regularTransactions,
    total: regularTotal,
    totals,
    isLoading: regularIsLoading,
    error: regularError,
    refetch: regularRefetch,
  } = useTransactions({
    filters,
    page,
    pageSize,
    sortColumn,
    sortDirection,
  });

  // Fetch account-specific transactions with running balance
  const fetchAccountTransactions = useCallback(async () => {
    if (!filters.accountId || !isSingleAccountFilter) return;

    setAccountIsLoading(true);
    setAccountError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', pageSize.toString());
      params.set('offset', ((page - 1) * pageSize).toString());
      params.set('sort_direction', sortDirection);
      params.set('_t', Date.now().toString()); // Cache-buster

      const response = await fetch(`/api/accounts/${filters.accountId}/transactions?${params.toString()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to fetch transactions'));
      }

      const result = await response.json();
      setAccountTransactions(result.data);
      setAccountTotal(result.total);
      setAccountName(result.account?.name || null);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'An error occurred');
      setAccountTransactions([]);
      setAccountTotal(0);
    } finally {
      setAccountIsLoading(false);
    }
  }, [filters.accountId, isSingleAccountFilter, page, pageSize, sortDirection]);

  useEffect(() => {
    if (isSingleAccountFilter) {
      fetchAccountTransactions();
    }
  }, [isSingleAccountFilter, fetchAccountTransactions]);

  // Use account-specific data when in single account mode
  const transactions: TransactionWithRunningBalance[] = isSingleAccountFilter ? accountTransactions : regularTransactions;
  const total = isSingleAccountFilter ? accountTotal : regularTotal;
  const isLoading = isSingleAccountFilter ? accountIsLoading : regularIsLoading;
  const error = isSingleAccountFilter ? accountError : regularError;

  const refetch = useCallback(async () => {
    await Promise.all([regularRefetch(), isSingleAccountFilter ? fetchAccountTransactions() : Promise.resolve()]);
  }, [regularRefetch, isSingleAccountFilter, fetchAccountTransactions]);

  // Remember what the bulk bar needs about each row we have seen.
  useEffect(() => {
    if (transactions.length === 0) return;
    setSelectionMeta((prev) => {
      const next = new Map(prev);
      for (const t of transactions) {
        next.set(t.id, {
          amount: Number(t.amount),
          description: t.description,
          needs_review: Boolean(t.needs_review),
          category_id: t.category_id,
        });
      }
      return next;
    });
  }, [transactions]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setAllMatching(null);
  }, []);

  // Clear selection when page/filters change
  useEffect(() => {
    clearSelection();
  }, [page, filters, sortColumn, sortDirection, clearSelection]);

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
    setAllMatching(null);
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handleSort = useCallback((column: string) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setPage(1);
  }, [sortColumn]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  // ---- Selection summary -------------------------------------------------

  const selection = useMemo(() => {
    let amount = 0;
    let allFlagged = selectedIds.size > 0;
    let merchant: string | null | undefined;
    let category: string | null | undefined;
    for (const id of Array.from(selectedIds)) {
      const meta = selectionMeta.get(id);
      if (!meta) {
        allFlagged = false;
        merchant = null;
        category = null;
        continue;
      }
      amount += meta.amount;
      if (!meta.needs_review) allFlagged = false;
      const key = merchantKey(meta.description);
      merchant = merchant === undefined ? key : merchant === key ? merchant : null;
      category = category === undefined ? meta.category_id : category === meta.category_id ? category : null;
    }
    return {
      amount: Math.round(amount * 100) / 100,
      allFlagged,
      merchant: merchant || null,
      commonCategoryId: category ?? null,
    };
  }, [selectedIds, selectionMeta]);

  const pageAllSelected = transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id));

  const handleSelectAllMatching = useCallback(async () => {
    setLoadingAllIds(true);
    try {
      const params = filterQueryParams(filters);
      const response = await fetch(`/api/transactions/ids?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readError(response, 'Failed to select all matching transactions'));
      const result: {
        ids: string[];
        rows: ({ id: string } & SelectionMeta)[];
        total: number;
        capped: boolean;
      } = await response.json();
      setSelectionMeta((prev) => {
        const next = new Map(prev);
        for (const r of result.rows ?? []) {
          next.set(r.id, {
            amount: Number(r.amount),
            description: r.description,
            needs_review: Boolean(r.needs_review),
            category_id: r.category_id ?? null,
          });
        }
        return next;
      });
      setSelectedIds(new Set(result.ids));
      setAllMatching({ total: result.total, capped: result.capped });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to select all matching transactions' });
    } finally {
      setLoadingAllIds(false);
    }
  }, [filters, toast]);

  // ---- Panel ---------------------------------------------------------------

  const openPanel = useCallback((transaction: TransactionWithRelations) => {
    setPanelTransaction(transaction);
    setPanelOpen(true);
  }, []);

  const handleAddTransaction = useCallback(() => {
    setPanelTransaction(null);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  // ---- Single delete -------------------------------------------------------

  const handleDelete = useCallback((transaction: TransactionWithRelations) => {
    setPanelOpen(false);
    setDeletingTransaction(transaction);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingTransaction) return;

    setIsOperating(true);
    try {
      const response = await fetch(`/api/transactions/${deletingTransaction.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to delete transaction'));
      }

      toast({ tone: 'success', message: 'Transaction deleted' });
      await refetch();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingTransaction.id);
        return next;
      });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to delete transaction' });
    } finally {
      setIsOperating(false);
      setDeleteDialogOpen(false);
      setDeletingTransaction(null);
    }
  }, [deletingTransaction, refetch, toast]);

  // ---- Bulk operations -----------------------------------------------------

  const bulkPut = useCallback(async (ids: string[], update: Record<string, unknown>) => {
    const response = await fetch('/api/transactions/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, update }),
    });
    if (!response.ok) {
      throw new Error(await readError(response, 'Failed to update transactions'));
    }
    return (await response.json()) as { updated: number; previous?: PreviousValues[] };
  }, []);

  /** Put each row's field back to its previous value (grouped by value). */
  const restore = useCallback(async (previous: PreviousValues[], field: UndoField) => {
    const groups = new Map<string, { value: unknown; ids: string[] }>();
    for (const p of previous) {
      const value = p[field];
      const k = String(value);
      const g = groups.get(k);
      if (g) g.ids.push(p.id);
      else groups.set(k, { value, ids: [p.id] });
    }
    for (const g of Array.from(groups.values())) {
      await bulkPut(g.ids, { [field]: g.value });
    }
  }, [bulkPut]);

  /** Bulk update with a toast, plus Undo restoring the previous values. */
  const runUndoable = useCallback(async (update: Partial<Record<UndoField, unknown>>, field: UndoField, done: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setIsOperating(true);
    try {
      const result = await bulkPut(ids, update);
      clearSelection();
      await refetch();
      const previous = result.previous ?? [];
      toast({
        tone: 'success',
        message: done,
        action: previous.length
          ? {
              label: 'Undo',
              onClick: () => {
                restore(previous, field)
                  .then(() => {
                    toast({ tone: 'neutral', message: 'Undone' });
                    return refetch();
                  })
                  .catch((err: unknown) =>
                    toast({ tone: 'error', message: err instanceof Error ? err.message : 'Undo failed' })
                  );
              },
            }
          : undefined,
      });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to update transactions' });
    } finally {
      setIsOperating(false);
    }
  }, [selectedIds, bulkPut, clearSelection, refetch, restore, toast]);

  const handleBulkSetCategory = useCallback(async (categoryId: string) => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setIsOperating(true);
    try {
      await bulkPut(Array.from(selectedIds), { category_id: categoryId, categorisation_source: 'manual' });
      const name = categoryData?.find((c) => c.id === categoryId)?.name ?? 'the category';
      clearSelection();
      await refetch();
      toast({ tone: 'success', message: `${plural(count, 'transaction')} set to ${name}` });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to update transactions' });
    } finally {
      setIsOperating(false);
    }
  }, [selectedIds, bulkPut, categoryData, clearSelection, refetch, toast]);

  const handleBulkValidate = useCallback(() => {
    void runUndoable({ is_validated: true }, 'is_validated', `${plural(selectedIds.size, 'transaction')} marked validated`);
  }, [runUndoable, selectedIds]);

  const handleBulkToggleFlag = useCallback(() => {
    const flag = !selection.allFlagged;
    void runUndoable(
      { needs_review: flag },
      'needs_review',
      flag ? `${plural(selectedIds.size, 'transaction')} flagged for review` : `Flag cleared on ${plural(selectedIds.size, 'transaction')}`
    );
  }, [runUndoable, selectedIds, selection.allFlagged]);

  const handleBulkMove = useCallback((accountId: string) => {
    const name = moveTargets.find((a) => a.id === accountId)?.name ?? 'the account';
    void runUndoable({ account_id: accountId }, 'account_id', `${plural(selectedIds.size, 'transaction')} moved to ${name}`);
  }, [runUndoable, selectedIds, moveTargets]);

  const handleMakeRule = useCallback(async (categoryId: string) => {
    const merchant = selection.merchant;
    if (!merchant || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const answers = [];
    for (let i = 0; i < ids.length; i += ANSWER_CHUNK) {
      answers.push({ transaction_ids: ids.slice(i, i + ANSWER_CHUNK), category_id: categoryId, ...(i === 0 ? { always: true } : {}) });
    }
    setIsOperating(true);
    try {
      const response = await fetch('/api/categorisation/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Failed to make the rule'));
      const json = await response.json().catch(() => null);
      const name = categoryData?.find((c) => c.id === categoryId)?.name;
      clearSelection();
      await refetch();
      toast(ruleToast(json?.results?.[0]?.rule, name, merchant));
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to make the rule' });
    } finally {
      setIsOperating(false);
    }
  }, [selection.merchant, selectedIds, categoryData, clearSelection, refetch, toast]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;

    setIsOperating(true);
    try {
      const response = await fetch('/api/transactions/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to delete transactions'));
      }

      clearSelection();
      await refetch();
      toast({ tone: 'success', message: `${plural(count, 'transaction')} deleted` });
    } catch (err) {
      toast({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete transactions',
      });
    } finally {
      setIsOperating(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [selectedIds, clearSelection, refetch, toast]);

  // ---- Inline edits --------------------------------------------------------

  const handleInlineUpdate = useCallback(async (id: string, field: 'description' | 'category_id', value: string | null) => {
    const scrollY = window.scrollY;

    try {
      const updateData: Record<string, unknown> = { [field]: value };
      if (field === 'category_id') {
        updateData.categorisation_source = value ? 'manual' : undefined;
      }

      const response = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to update transaction'));
      }

      await refetch();

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to update transaction' });
      throw err; // Re-throw so the component can handle the error state
    }
  }, [refetch, toast]);

  // Validation toggle - preserves scroll position
  const handleValidate = useCallback(async (transaction: TransactionWithRelations) => {
    const scrollY = window.scrollY;

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/validate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to toggle validation'));
      }

      await refetch();

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to toggle validation' });
    }
  }, [refetch, toast]);

  const keyboardEnabled = !panelOpen && !deleteDialogOpen && !bulkDeleteDialogOpen;

  return (
    <>
      <div className="space-y-3 pb-4">
        {/* Header line */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-sm text-ink-2">
            {isSingleAccountFilter && accountName && (
              <p className="mb-0.5">
                <span className="font-medium text-ink">{accountName}</span>
                <span className="text-ink-3"> · </span>
                <button
                  type="button"
                  onClick={() => handleFilterChange({})}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  View all transactions
                </button>
              </p>
            )}
            <p data-testid="transactions-summary" aria-live="polite">
              <span className="fig font-medium text-ink">{regularTotal.toLocaleString('en-GB')}</span>{' '}
              {regularTotal === 1 ? 'transaction matches' : 'transactions match'}
              {totals && (
                <>
                  <span className="text-ink-3"> · </span>
                  <span className="fig text-ink">{formatGBP(totals.out, { pence: true })}</span> out
                  <span className="text-ink-3"> · </span>
                  <span className="fig text-in">{formatGBP(totals.in, { pence: true })}</span> in
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SyncButton label="Sync all accounts" />
            <button
              type="button"
              onClick={handleAddTransaction}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add transaction
            </button>
          </div>
        </div>

        {/* Filters */}
        <TransactionFilters filters={filters} onChange={handleFilterChange} />

        {/* Error state */}
        {error && (
          <div role="alert" className="rounded-md border border-bad bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        {/* Select-all-matching banner */}
        {selectedIds.size > 0 && (pageAllSelected || allMatching) && total > transactions.length && (
          <div className="rounded-md border border-line bg-sunk px-3 py-2 text-sm text-ink-2">
            {allMatching ? (
              <>
                {allMatching.capped
                  ? `The first ${selectedIds.size.toLocaleString('en-GB')} of ${allMatching.total.toLocaleString('en-GB')} matching transactions are selected (the limit for one action).`
                  : `All ${plural(selectedIds.size, 'matching transaction')} are selected.`}{' '}
                <button type="button" onClick={clearSelection} className="text-accent underline underline-offset-2 hover:no-underline">
                  Clear selection
                </button>
              </>
            ) : (
              <>
                All {transactions.length} on this page are selected.{' '}
                <button
                  type="button"
                  onClick={handleSelectAllMatching}
                  disabled={loadingAllIds}
                  className="text-accent underline underline-offset-2 hover:no-underline disabled:opacity-50"
                >
                  {loadingAllIds ? 'Selecting...' : `Select all ${total.toLocaleString('en-GB')} matching`}
                </button>
              </>
            )}
          </div>
        )}

        {/* Table */}
        <TransactionTable
          transactions={transactions}
          isLoading={isLoading || isOperating}
          onSort={handleSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          onOpen={openPanel}
          onDelete={handleDelete}
          onValidate={handleValidate}
          onInlineUpdate={handleInlineUpdate}
          showRunningBalance={isSingleAccountFilter}
          hideAccountColumn={isSingleAccountFilter}
          keyboardEnabled={keyboardEnabled}
        />

        {/* Pagination */}
        <TransactionPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />

        {selectedIds.size > 0 && (
          <TransactionBulkBar
            count={selectedIds.size}
            amount={selection.amount}
            busy={isOperating}
            allFlagged={selection.allFlagged}
            merchant={selection.merchant}
            commonCategoryId={selection.commonCategoryId}
            accounts={moveTargets}
            onSetCategory={handleBulkSetCategory}
            onMarkValidated={handleBulkValidate}
            onToggleFlag={handleBulkToggleFlag}
            onMove={handleBulkMove}
            onMakeRule={handleMakeRule}
            onDelete={() => setBulkDeleteDialogOpen(true)}
            onClear={clearSelection}
          />
        )}
      </div>

      <TransactionPanel
        open={panelOpen}
        transaction={panelTransaction}
        onClose={closePanel}
        onSaved={() => void refetch()}
        onDelete={handleDelete}
        defaultAccountId={filters.accountId}
      />

      {/* Single Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="Delete Transaction"
        message={`Are you sure you want to delete this transaction? "${deletingTransaction?.description || ''}" This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDeletingTransaction(null);
        }}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={bulkDeleteDialogOpen}
        title="Delete Selected Transactions"
        message={`Are you sure you want to delete ${plural(selectedIds.size, 'transaction')}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Transaction${selectedIds.size === 1 ? '' : 's'}`}
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteDialogOpen(false)}
      />
    </>
  );
}
