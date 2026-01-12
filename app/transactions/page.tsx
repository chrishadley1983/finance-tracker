'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import {
  TransactionFilters,
  TransactionTable,
  TransactionPagination,
  TransactionToolbar,
  TransactionEditModal,
  TransactionFormData,
} from '@/components/transactions';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTransactions, FilterState, TransactionWithRelations } from '@/lib/hooks/useTransactions';

interface Category {
  id: string;
  name: string;
  group_name: string;
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();

  // Initialize filters from URL params
  const getInitialFilters = (): FilterState => {
    const filters: FilterState = {};
    const categoryId = searchParams.get('categoryId');
    const accountId = searchParams.get('accountId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    if (categoryId) filters.categoryId = categoryId;
    if (accountId) filters.accountId = accountId;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (search) filters.search = search;

    return filters;
  };

  const [filters, setFilters] = useState<FilterState>(getInitialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Categories for toolbar
  const [categories, setCategories] = useState<Category[]>([]);

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRelations | null>(null);

  // Confirm dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionWithRelations | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Loading states for operations
  const [isOperating, setIsOperating] = useState(false);

  const { transactions, total, isLoading, error, refetch } = useTransactions({
    filters,
    page,
    pageSize,
    sortColumn,
    sortDirection,
  });

  // Fetch categories on mount
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          // Transform API response to expected format
          // API returns category_groups as nested object from join
          const transformed = data.map((cat: { id: string; name: string; group_name?: string; category_groups?: { name: string } | null }) => ({
            id: cat.id,
            name: cat.name,
            group_name: cat.category_groups?.name || cat.group_name || 'Ungrouped',
          }));
          setCategories(transformed);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    }
    fetchCategories();
  }, []);

  // Clear selection when page/filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, filters, sortColumn, sortDirection]);

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

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(transactions.map((t) => t.id)));
  }, [transactions]);

  const handleSelectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Edit handlers
  const handleEdit = useCallback((transaction: TransactionWithRelations) => {
    setEditingTransaction(transaction);
    setEditModalOpen(true);
  }, []);

  const handleAddTransaction = useCallback(() => {
    setEditingTransaction(null);
    setEditModalOpen(true);
  }, []);

  const handleSaveTransaction = useCallback(async (formData: TransactionFormData) => {
    setIsOperating(true);
    try {
      if (formData.id) {
        // Update existing
        const response = await fetch(`/api/transactions/${formData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: formData.date,
            description: formData.description,
            amount: formData.amount,
            account_id: formData.account_id,
            category_id: formData.category_id,
            categorisation_source: formData.category_id ? 'manual' : undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update transaction');
        }
      } else {
        // Create new
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: formData.date,
            description: formData.description,
            amount: formData.amount,
            account_id: formData.account_id,
            category_id: formData.category_id,
            categorisation_source: 'manual',
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create transaction');
        }
      }

      refetch();
      setEditModalOpen(false);
      setEditingTransaction(null);
    } finally {
      setIsOperating(false);
    }
  }, [refetch]);

  // Delete handlers
  const handleDelete = useCallback((transaction: TransactionWithRelations) => {
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
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete transaction');
      }

      refetch();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingTransaction.id);
        return next;
      });
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsOperating(false);
      setDeleteDialogOpen(false);
      setDeletingTransaction(null);
    }
  }, [deletingTransaction, refetch]);

  // Bulk operations
  const handleBulkSetCategory = useCallback(async (categoryId: string) => {
    if (selectedIds.size === 0) return;

    setIsOperating(true);
    try {
      const response = await fetch('/api/transactions/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          update: {
            category_id: categoryId || null,
            categorisation_source: categoryId ? 'manual' : undefined,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update transactions');
      }

      refetch();
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk update error:', err);
    } finally {
      setIsOperating(false);
    }
  }, [selectedIds, refetch]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedIds]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

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
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete transactions');
      }

      refetch();
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk delete error:', err);
    } finally {
      setIsOperating(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [selectedIds, refetch]);

  // Inline update handler for description and category
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
        const data = await response.json();
        throw new Error(data.error || 'Failed to update transaction');
      }

      await refetch();

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    } catch (err) {
      console.error('Inline update error:', err);
      throw err; // Re-throw so the component can handle the error state
    }
  }, [refetch]);

  // Validation handler - preserves scroll position
  const handleValidate = useCallback(async (transaction: TransactionWithRelations) => {
    // Save scroll position before refetch
    const scrollY = window.scrollY;

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/validate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle validation');
      }

      await refetch();

      // Restore scroll position after refetch
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    } catch (err) {
      console.error('Validation error:', err);
    }
  }, [refetch]);

  return (
    <AppLayout title="Transactions">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Manage and view all your transactions
          </p>
        </div>

        {/* Toolbar */}
        <TransactionToolbar
          selectedCount={selectedIds.size}
          totalCount={transactions.length}
          categories={categories}
          onSelectAll={handleSelectAll}
          onSelectNone={handleSelectNone}
          onBulkSetCategory={handleBulkSetCategory}
          onBulkDelete={handleBulkDelete}
          onAddTransaction={handleAddTransaction}
        />

        {/* Filters */}
        <TransactionFilters filters={filters} onChange={handleFilterChange} />

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
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
          onSelectionChange={setSelectedIds}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onValidate={handleValidate}
          categories={categories}
          onInlineUpdate={handleInlineUpdate}
        />

        {/* Pagination */}
        <TransactionPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* Edit Modal */}
      <TransactionEditModal
        isOpen={editModalOpen}
        transaction={editingTransaction}
        onSave={handleSaveTransaction}
        onClose={() => {
          setEditModalOpen(false);
          setEditingTransaction(null);
        }}
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
        message={`Are you sure you want to delete ${selectedIds.size} transaction${selectedIds.size === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Transaction${selectedIds.size === 1 ? '' : 's'}`}
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteDialogOpen(false)}
      />
    </AppLayout>
  );
}
