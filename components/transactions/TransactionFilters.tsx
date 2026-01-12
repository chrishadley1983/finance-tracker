'use client';

import { useState, useEffect } from 'react';
import { FilterState } from '@/lib/hooks/useTransactions';

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  group_name: string;
  group_id: string | null;
  category_groups?: {
    id: string;
    name: string;
  } | null;
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

  // Account types that can have transactions
  const TRANSACTION_ACCOUNT_TYPES = ['current', 'savings', 'credit'];

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const response = await fetch('/api/accounts');
        if (response.ok) {
          const data = await response.json();
          // Only show accounts that can have transactions
          const transactionAccounts = (data.accounts || []).filter(
            (account: Account) => TRANSACTION_ACCOUNT_TYPES.includes(account.type)
          );
          setAccounts(transactionAccounts);
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

  const handleValidatedChange = (value: string) => {
    onChange({ ...filters, validated: (value || undefined) as FilterState['validated'] });
  };

  const handleClearFilters = () => {
    onChange({});
  };

  const hasFilters = filters.accountId || filters.categoryId || filters.dateFrom || filters.dateTo || filters.search || (filters.validated && filters.validated !== 'all');

  // Group categories by group name (prefer category_groups relationship over legacy group_name)
  const categoriesByGroup = categories.reduce((acc, category) => {
    const groupName = category.category_groups?.name || category.group_name || 'Uncategorised';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(category);
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

      {/* Validation status filter */}
      <div className="min-w-[140px]">
        <select
          value={filters.validated || 'all'}
          onChange={(e) => handleValidatedChange(e.target.value)}
          className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="validated">Validated</option>
          <option value="unvalidated">Unvalidated</option>
        </select>
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
