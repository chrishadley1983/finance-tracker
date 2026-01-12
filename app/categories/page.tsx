'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  CategoryFilters,
  CategoryGroupList,
  CategoryDialog,
  GroupDialog,
  DeleteCategoryDialog,
  ReassignCategoryDialog,
  RulesPanel,
} from '@/components/categories';
import type {
  CategoryWithStats,
  CategoryGroup,
  CategoryTypeFilter,
  CategoryFormData,
  CategoryGroupFormData,
} from '@/lib/types/category';

interface CategoryGroupWithCategories extends CategoryGroup {
  categories: CategoryWithStats[];
}

export default function CategoriesPage() {
  // Data state
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CategoryTypeFilter>('all');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  // Dialog state
  const [editingCategory, setEditingCategory] = useState<CategoryWithStats | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<CategoryWithStats | null>(null);
  const [reassigningCategory, setReassigningCategory] = useState<CategoryWithStats | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [categoriesRes, groupsRes] = await Promise.all([
        fetch('/api/categories?stats=true'),
        fetch('/api/category-groups'),
      ]);

      if (!categoriesRes.ok || !groupsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [categoriesData, groupsData] = await Promise.all([
        categoriesRes.json(),
        groupsRes.json(),
      ]);

      setCategories(categoriesData);
      setGroups(groupsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter categories
  const filteredCategories = categories.filter(cat => {
    // Search filter
    if (searchQuery && !cat.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Type filter
    if (typeFilter === 'income' && !cat.is_income) return false;
    if (typeFilter === 'expense' && cat.is_income) return false;
    // Group filter
    if (groupFilter && cat.group_id !== groupFilter) return false;

    return true;
  });

  // Group categories by group
  const groupedCategories: CategoryGroupWithCategories[] = groups.map(group => ({
    ...group,
    categories: filteredCategories.filter(cat => cat.group_id === group.id),
  })).filter(g => g.categories.length > 0 || !searchQuery);

  const uncategorisedCategories = filteredCategories.filter(cat => !cat.group_id);

  // Stats
  const stats = {
    total: categories.length,
    income: categories.filter(c => c.is_income).length,
    expense: categories.filter(c => !c.is_income).length,
    rules: 0, // Will be fetched by RulesPanel
  };

  // Category CRUD handlers
  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: CategoryWithStats) => {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async (data: CategoryFormData) => {
    const url = editingCategory
      ? `/api/categories/${editingCategory.id}`
      : '/api/categories';
    const method = editingCategory ? 'PUT' : 'POST';

    // Also need to set group_name for backward compatibility
    const group = groups.find(g => g.id === data.group_id);

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        group_name: group?.name || data.group_id ? undefined : 'Ungrouped',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save category');
    }

    await fetchData();
  };

  const handleDeleteCategory = (category: CategoryWithStats) => {
    setDeletingCategory(category);
  };

  const handleConfirmDelete = async (force: boolean) => {
    if (!deletingCategory) return;

    const url = `/api/categories/${deletingCategory.id}${force ? '?force=true' : ''}`;
    const response = await fetch(url, { method: 'DELETE' });

    if (!response.ok && response.status !== 204) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete category');
    }

    setDeletingCategory(null);
    await fetchData();
  };

  const handleReassignFromDelete = () => {
    if (deletingCategory) {
      setReassigningCategory(deletingCategory);
      setDeletingCategory(null);
    }
  };

  const handleReassign = async (targetCategoryId: string) => {
    if (!reassigningCategory) return;

    const response = await fetch(`/api/categories/${reassigningCategory.id}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_category_id: targetCategoryId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reassign transactions');
    }

    setReassigningCategory(null);
    await fetchData();
  };

  // Group CRUD handlers
  const handleAddGroup = () => {
    setEditingGroup(null);
    setIsGroupDialogOpen(true);
  };

  const handleEditGroup = (group: CategoryGroup) => {
    setEditingGroup(group);
    setIsGroupDialogOpen(true);
  };

  const handleSaveGroup = async (data: CategoryGroupFormData) => {
    const url = editingGroup
      ? `/api/category-groups/${editingGroup.id}`
      : '/api/category-groups';
    const method = editingGroup ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save group');
    }

    await fetchData();
  };

  const handleDeleteGroup = async (group: CategoryGroup) => {
    if (!confirm(`Are you sure you want to delete the group "${group.name}"?`)) return;

    const response = await fetch(`/api/category-groups/${group.id}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json();
      alert(error.message || error.error || 'Failed to delete group');
      return;
    }

    await fetchData();
  };

  return (
    <AppLayout title="Categories">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Expense</p>
          <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{stats.expense}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Income</p>
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{stats.income}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Groups</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{groups.length}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Filters */}
      <CategoryFilters
        search={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        groups={groups}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        onAddCategory={handleAddCategory}
        onAddGroup={handleAddGroup}
      />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories list */}
        <div className="lg:col-span-2">
          <CategoryGroupList
            groups={groupedCategories}
            uncategorised={uncategorisedCategories}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
            isLoading={isLoading}
          />
        </div>

        {/* Rules panel */}
        <div className="lg:col-span-1">
          <RulesPanel
            categories={categories}
            selectedCategoryId={null}
          />
        </div>
      </div>

      {/* Dialogs */}
      <CategoryDialog
        category={editingCategory}
        groups={groups}
        isOpen={isCategoryDialogOpen}
        onClose={() => setIsCategoryDialogOpen(false)}
        onSave={handleSaveCategory}
      />

      <GroupDialog
        group={editingGroup}
        isOpen={isGroupDialogOpen}
        onClose={() => setIsGroupDialogOpen(false)}
        onSave={handleSaveGroup}
      />

      <DeleteCategoryDialog
        category={deletingCategory}
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onDelete={handleConfirmDelete}
        onReassign={handleReassignFromDelete}
      />

      <ReassignCategoryDialog
        category={reassigningCategory}
        allCategories={categories}
        isOpen={!!reassigningCategory}
        onClose={() => setReassigningCategory(null)}
        onReassign={handleReassign}
      />
    </AppLayout>
  );
}
