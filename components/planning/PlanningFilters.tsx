'use client';

import { Search, X } from 'lucide-react';
import { controlClass } from '@/components/ui/Field';

interface PlanningFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
}

/** Search box and the archived-sections toggle. Page actions live in the intro. */
export function PlanningFilters({ searchQuery, onSearchChange, showArchived, onToggleArchived }: PlanningFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 basis-60">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && searchQuery) {
              e.preventDefault();
              onSearchChange('');
            }
          }}
          placeholder="Search notes and tags"
          aria-label="Search notes"
          className={`${controlClass} pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={showArchived} onChange={onToggleArchived} className="h-4 w-4 accent-accent" />
        Show archived sections
      </label>
    </div>
  );
}
