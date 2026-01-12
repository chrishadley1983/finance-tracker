'use client';

import { CategoryTypeFilter } from '@/lib/types/category';

interface CategoryGroup {
  id: string;
  name: string;
}

interface CategoryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: CategoryTypeFilter;
  onTypeFilterChange: (value: CategoryTypeFilter) => void;
  groups: CategoryGroup[];
  groupFilter: string | null;
  onGroupFilterChange: (value: string | null) => void;
  onAddCategory: () => void;
  onAddGroup: () => void;
}

export function CategoryFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  groups,
  groupFilter,
  onGroupFilterChange,
  onAddCategory,
  onAddGroup,
}: CategoryFiltersProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                     bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                     placeholder-slate-400 dark:placeholder-slate-500
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-md p-1">
          {(['all', 'expense', 'income'] as CategoryTypeFilter[]).map((type) => (
            <button
              key={type}
              onClick={() => onTypeFilterChange(type)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                typeFilter === type
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Group filter */}
        <select
          value={groupFilter || ''}
          onChange={(e) => onGroupFilterChange(e.target.value || null)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                   bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Groups</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onAddGroup}
            className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                     border border-slate-300 dark:border-slate-600 rounded-md
                     hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            + Group
          </button>
          <button
            onClick={onAddCategory}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
                     hover:bg-blue-700 transition-colors"
          >
            + Category
          </button>
        </div>
      </div>
    </div>
  );
}
