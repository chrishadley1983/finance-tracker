'use client';

import type { AccountType } from '@/lib/types/account';
import { accountTypeConfig } from '@/lib/types/account';

interface AccountFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: AccountType | 'all';
  onTypeFilterChange: (type: AccountType | 'all') => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  onAddAccount: () => void;
}

const accountTypes: AccountType[] = [
  'current',
  'savings',
  'credit',
  'investment',
  'pension',
  'isa',
  'property',
  'other',
];

export function AccountFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  showArchived,
  onToggleArchived,
  onAddAccount,
}: AccountFiltersProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Type filter */}
        <div className="lg:w-48">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as AccountType | 'all')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            {accountTypes.map((type) => (
              <option key={type} value={type}>
                {accountTypeConfig[type].icon} {accountTypeConfig[type].label}
              </option>
            ))}
          </select>
        </div>

        {/* Show archived toggle */}
        <label className="flex items-center gap-2 cursor-pointer lg:whitespace-nowrap">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={onToggleArchived}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show archived</span>
        </label>

        {/* Add account button */}
        <button
          onClick={onAddAccount}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors lg:whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>
    </div>
  );
}
