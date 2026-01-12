'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  MonthSelector,
  ViewToggle,
  BudgetSummaryCards,
  BudgetGroupTable,
  BudgetEditDialog,
  BudgetBulkEditDialog,
  ExportMenu,
  CopyBudgetDialog,
} from '@/components/budgets';
import { useBudgets } from '@/lib/hooks/useBudgets';
import type { BudgetComparison } from '@/lib/types/budget';

interface MonthlyBudget {
  month: number;
  amount: number;
}

export default function BudgetsPage() {
  const {
    year,
    month,
    viewMode,
    groups,
    savingsRate,
    isLoading,
    error,
    setYear,
    setMonth,
    setViewMode,
    refresh,
  } = useBudgets();

  // Edit state
  const [editingCategory, setEditingCategory] = useState<BudgetComparison | null>(null);
  const [editingCategoryGroup, setEditingCategoryGroup] = useState<string>('');
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [bulkBudgets, setBulkBudgets] = useState<MonthlyBudget[]>([]);
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  // Check if there are no budgets for this year
  const hasBudgets = groups.some((g) =>
    g.categories.some((c) => c.budgetAmount > 0)
  );

  const handleEditCategory = useCallback(async (categoryId: string) => {
    // Find the category in the groups
    for (const group of groups) {
      const category = group.categories.find((c) => c.categoryId === categoryId);
      if (category) {
        setEditingCategory(category);
        setEditingCategoryGroup(group.groupName);

        if (viewMode === 'year') {
          // Fetch all monthly budgets for bulk edit
          try {
            const res = await fetch(`/api/budgets/bulk?year=${year}`);
            if (res.ok) {
              const data = await res.json();
              const catBudgets = data.budgets.find(
                (b: { categoryId: string }) => b.categoryId === categoryId
              );
              if (catBudgets) {
                const monthlyBudgets: MonthlyBudget[] = [];
                for (let m = 1; m <= 12; m++) {
                  monthlyBudgets.push({
                    month: m,
                    amount: catBudgets.months[m]?.amount || 0,
                  });
                }
                setBulkBudgets(monthlyBudgets);
              } else {
                // No existing budgets, start with zeros
                setBulkBudgets(
                  Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }))
                );
              }
            }
          } catch (err) {
            console.error('Failed to fetch bulk budgets:', err);
            setBulkBudgets(
              Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }))
            );
          }
          setIsBulkEdit(true);
        } else {
          setIsBulkEdit(false);
        }
        break;
      }
    }
  }, [groups, viewMode, year]);

  const handleSaveSingleBudget = useCallback(async (amount: number) => {
    if (!editingCategory || month === null) return;

    const res = await fetch('/api/budgets/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: [
          {
            categoryId: editingCategory.categoryId,
            year,
            month,
            amount,
          },
        ],
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save budget');
    }

    await refresh();
  }, [editingCategory, year, month, refresh]);

  const handleSaveBulkBudgets = useCallback(async (budgets: MonthlyBudget[]) => {
    if (!editingCategory) return;

    const entries = budgets.map((b) => ({
      categoryId: editingCategory.categoryId,
      year,
      month: b.month,
      amount: b.amount,
    }));

    const res = await fetch('/api/budgets/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save budgets');
    }

    await refresh();
  }, [editingCategory, year, refresh]);

  const handleCloseEdit = useCallback(() => {
    setEditingCategory(null);
    setEditingCategoryGroup('');
    setIsBulkEdit(false);
    setBulkBudgets([]);
  }, []);

  return (
    <AppLayout title="Budgets">
      <div className="grid gap-6">
        {/* Header with controls */}
        <div className="flex items-center justify-between">
          <MonthSelector
            year={year}
            month={month}
            onYearChange={setYear}
            onMonthChange={setMonth}
            viewMode={viewMode}
          />
          <div className="flex items-center gap-4">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            <ExportMenu
              year={year}
              month={month}
              groups={groups}
              savingsRate={savingsRate}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* No budgets message with copy option */}
        {!isLoading && !hasBudgets && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-slate-900">
              No budgets for {year}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Get started by copying budgets from a previous year.
            </p>
            <button
              onClick={() => setShowCopyDialog(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy from Previous Year
            </button>
          </div>
        )}

        {/* Summary cards */}
        {(isLoading || hasBudgets) && (
          <BudgetSummaryCards savingsRate={savingsRate} isLoading={isLoading} />
        )}

        {/* Budget table */}
        {(isLoading || hasBudgets) && (
          <BudgetGroupTable
            groups={groups}
            isLoading={isLoading}
            onEditCategory={handleEditCategory}
          />
        )}
      </div>

      {/* Single month edit dialog */}
      {editingCategory && !isBulkEdit && month !== null && (
        <BudgetEditDialog
          isOpen={true}
          onClose={handleCloseEdit}
          onSave={handleSaveSingleBudget}
          categoryName={editingCategory.categoryName}
          groupName={editingCategoryGroup}
          year={year}
          month={month}
          currentAmount={editingCategory.budgetAmount}
        />
      )}

      {/* Bulk edit dialog for year view */}
      {editingCategory && isBulkEdit && (
        <BudgetBulkEditDialog
          isOpen={true}
          onClose={handleCloseEdit}
          onSave={handleSaveBulkBudgets}
          categoryId={editingCategory.categoryId}
          categoryName={editingCategory.categoryName}
          groupName={editingCategoryGroup}
          year={year}
          currentBudgets={bulkBudgets}
        />
      )}

      {/* Copy budget dialog */}
      <CopyBudgetDialog
        isOpen={showCopyDialog}
        onClose={() => setShowCopyDialog(false)}
        onSuccess={refresh}
        targetYear={year}
      />
    </AppLayout>
  );
}
