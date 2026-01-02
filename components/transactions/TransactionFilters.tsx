'use client';

import { useState, useEffect } from 'react';
import { FilterState } from '@/lib/hooks/useTransactions';

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  group_name: string;
}

interface TransactionFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function TransactionFilters({ filters, onChange }: TransactionFiltersProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const response = await fetch('/api/accounts');
        if (response.ok) {
          const data = await response.json();
          setAccounts(data.accounts || []);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        setIsLoadingAccounts(false);
      }
    }
    fetchAccounts();
  }, []);

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  const handleAccountChange = (value: string) => {
    onChange({ ...filters, accountId: value || undefined });
  };

  const handleCategoryChange = (value: string) => {
    onChange({ ...filters, categoryId: value || undefined });
  };

  const handleDateFromChange = (value: string) => {
    onChange({ ...filters, dateFrom: value || undefined });
  };

  const handleDateToChange = (value: string) => {
    onChange({ ...filters, dateTo: value || undefined });
  };

  const handleSearchChange = (value: string) => {
    onChange({ ...filters, search: value || undefined });
  };

  const handleClearFilters = () => {
    onChange({});
  };

  const hasFilters = filters.accountId || filters.categoryId || filters.dateFrom || filters.dateTo || filters.search;

  // Group categories by group_name
  const categoriesByGroup = categories.reduce((acc, category) => {
    if (!acc[category.group_name]) {
      acc[category.group_name] = [];
    }
    acc[category.group_name].push(category);
    return acc;
  }, {} as Record<string, Category[]>);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <input
          type="text"
          placeholder="Search description..."
          value={filters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Account dropdown */}
      <div className="min-w-[180px]">
        <select
          value={filters.accountId || ''}
          onChange={(e) => handleAccountChange(e.target.value)}
          disabled={isLoadingAccounts}
          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-100"
        >
          <option value="">All Accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category dropdown */}
      <div className="min-w-[180px]">
        <select
          value={filters.categoryId || ''}
          onChange={(e) => handleCategoryChange(e.target.value)}
          disabled={isLoadingCategories}
          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-100"
        >
          <option value="">All Categories</option>
          {Object.entries(categoriesByGroup).map(([groupName, groupCategories]) => (
            <optgroup key={groupName} label={groupName}>
              {groupCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Date from */}
      <div className="min-w-[150px]">
        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => handleDateFromChange(e.target.value)}
          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="From date"
        />
      </div>

      {/* Date to */}
      <div className="min-w-[150px]">
        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => handleDateToChange(e.target.value)}
          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="To date"
        />
      </div>

      {/* Clear filters button */}
      {hasFilters && (
        <button
          onClick={handleClearFilters}
          className="h-10 px-4 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
