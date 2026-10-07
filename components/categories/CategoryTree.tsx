'use client';

import { Search } from 'lucide-react';
import type { CategoryGroup, CategoryTypeFilter, CategoryWithStats } from '@/lib/types/category';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, SkeletonRows } from '@/components/ui/Notice';
import { RowMenu } from '@/components/dialogs/RowMenu';

export interface CategoryTreeGroup {
  id: string | null;
  name: string;
  colour: string | null;
  group: CategoryGroup | null;
  categories: CategoryWithStats[];
}

interface CategoryTreeProps {
  groups: CategoryTreeGroup[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  ruleCounts: Map<string, number>;
  totalRules: number;
  search: string;
  onSearch: (q: string) => void;
  typeFilter: CategoryTypeFilter;
  onTypeFilter: (t: CategoryTypeFilter) => void;
  onEditCategory: (c: CategoryWithStats) => void;
  onDeleteCategory: (c: CategoryWithStats) => void;
  onReassignCategory: (c: CategoryWithStats) => void;
  onEditGroup: (g: CategoryGroup) => void;
  onDeleteGroup: (g: CategoryGroup) => void;
}

const TYPES: { id: CategoryTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Spending' },
  { id: 'income', label: 'Income' },
];

function Dot({ colour }: { colour: string | null }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-line" style={{ backgroundColor: colour ?? 'var(--line)' }} aria-hidden />;
}

const rowBase =
  'flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left text-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent';

/** Left pane: groups and their categories. Selecting a category filters the rules pane. */
export function CategoryTree({
  groups,
  isLoading,
  selectedId,
  onSelect,
  ruleCounts,
  totalRules,
  search,
  onSearch,
  typeFilter,
  onTypeFilter,
  onEditCategory,
  onDeleteCategory,
  onReassignCategory,
  onEditGroup,
  onDeleteGroup,
}: CategoryTreeProps) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-3">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Find a category"
            aria-label="Find a category"
            className="w-full min-w-0 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none"
          />
        </label>
        <div role="group" aria-label="Category type" className="flex gap-3.5 text-[13px]">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={typeFilter === t.id}
              onClick={() => onTypeFilter(t.id)}
              className={`pb-0.5 focus-visible:outline-2 focus-visible:outline-accent ${
                typeFilter === t.id ? 'border-b-[1.5px] border-ink text-ink' : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[3px] border border-line bg-surface">
        <button
          type="button"
          aria-pressed={selectedId === null}
          onClick={() => onSelect(null)}
          className={`${rowBase} border-b border-line ${selectedId === null ? 'bg-sel font-medium text-ink' : 'text-ink-2 hover:bg-sunk'}`}
        >
          <span className="flex-1">All rules</span>
          <span className="fig text-xs text-ink-3">{totalRules}</span>
        </button>

        {isLoading ? (
          <div className="p-3">
            <SkeletonRows rows={8} />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState title="No categories match">Try another name or type.</EmptyState>
        ) : (
          groups.map((g) => (
            <div key={g.id ?? 'ungrouped'} role="group" aria-label={g.name}>
              <div className="flex items-center gap-2 border-b border-line-2 bg-sunk px-3 py-1.5 text-[12.5px] text-ink-2">
                <Dot colour={g.colour} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{g.name}</span>
                <span className="fig text-xs text-ink-3">{g.categories.length}</span>
                {g.group && (
                  <RowMenu
                    label={`Actions for group ${g.name}`}
                    items={[
                      { label: 'Edit group', onSelect: () => onEditGroup(g.group!) },
                      { label: 'Delete group', onSelect: () => onDeleteGroup(g.group!), danger: true },
                    ]}
                  />
                )}
              </div>
              {g.categories.length === 0 ? (
                <p className="border-b border-line-2 px-3 py-2 text-xs text-ink-3">No categories in this group yet.</p>
              ) : (
                <ul>
                  {g.categories.map((c) => {
                    const on = c.id === selectedId;
                    const rules = ruleCounts.get(c.id) ?? 0;
                    return (
                      <li key={c.id} className={`flex items-center border-b border-line-2 pr-2 ${on ? 'bg-sel' : 'hover:bg-sunk'}`}>
                        <button type="button" aria-pressed={on} onClick={() => onSelect(c.id)} className={`${rowBase} flex-1 pl-7`}>
                          <Dot colour={c.colour} />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate ${on ? 'font-medium text-ink' : 'text-ink'}`}>{c.name}</span>
                            <span className="block truncate text-xs text-ink-3">
                              {(c.transaction_count ?? 0).toLocaleString('en-GB')} transactions · {rules} rule{rules === 1 ? '' : 's'}
                            </span>
                          </span>
                          {c.is_income && <Chip tone="in">Income</Chip>}
                          {c.exclude_from_totals && <Chip>Not in totals</Chip>}
                        </button>
                        <RowMenu
                          label={`Actions for ${c.name}`}
                          items={[
                            { label: 'Edit category', onSelect: () => onEditCategory(c) },
                            { label: 'Move transactions', onSelect: () => onReassignCategory(c), hidden: !c.transaction_count },
                            { label: 'Delete category', onSelect: () => onDeleteCategory(c), danger: true },
                          ]}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
