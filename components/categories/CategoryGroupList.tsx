'use client';

import { useState } from 'react';
import { CategoryWithStats, CategoryGroup } from '@/lib/types/category';
import { CategoryCard } from './CategoryCard';

interface CategoryGroupWithCategories extends CategoryGroup {
  categories: CategoryWithStats[];
}

interface CategoryGroupListProps {
  groups: CategoryGroupWithCategories[];
  uncategorised: CategoryWithStats[];
  onEditCategory: (category: CategoryWithStats) => void;
  onDeleteCategory: (category: CategoryWithStats) => void;
  onEditGroup: (group: CategoryGroup) => void;
  onDeleteGroup: (group: CategoryGroup) => void;
  isLoading?: boolean;
}

export function CategoryGroupList({
  groups,
  uncategorised,
  onEditCategory,
  onDeleteCategory,
  onEditGroup,
  onDeleteGroup,
  isLoading,
}: CategoryGroupListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groups.map(g => g.id))
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
            <div className="ml-4 space-y-2">
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Groups */}
      {groups.map(group => (
        <div key={group.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Group header */}
          <div
            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 cursor-pointer"
            onClick={() => toggleGroup(group.id)}
          >
            <div className="flex items-center gap-3">
              {/* Expand/collapse arrow */}
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  expandedGroups.has(group.id) ? 'rotate-90' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              {/* Group colour */}
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: group.colour || '#94a3b8' }}
              />

              {/* Group name */}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {group.name}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                ({group.categories.length})
              </span>
            </div>

            {/* Group actions */}
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => onEditGroup(group)}
                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Edit group"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDeleteGroup(group)}
                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Delete group"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Categories in group */}
          {expandedGroups.has(group.id) && (
            <div className="p-3 space-y-2">
              {group.categories.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic py-2 px-3">
                  No categories in this group
                </p>
              ) : (
                group.categories.map(category => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onEdit={onEditCategory}
                    onDelete={onDeleteCategory}
                  />
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {/* Uncategorised categories */}
      {uncategorised.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Ungrouped
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              ({uncategorised.length})
            </span>
          </div>
          <div className="p-3 space-y-2">
            {uncategorised.map(category => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={onEditCategory}
                onDelete={onDeleteCategory}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
