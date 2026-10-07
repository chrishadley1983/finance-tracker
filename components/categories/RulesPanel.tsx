'use client';

import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, Notice, SkeletonRows } from '@/components/ui/Notice';
import { RowMenu } from '@/components/dialogs/RowMenu';

export interface CategoryMapping {
  id: string;
  pattern: string;
  match_type: string;
  category_id: string;
  confidence: number;
  is_system: boolean;
  notes: string | null;
  created_at: string;
  category?: { id: string; name: string; group_name?: string | null };
}

export const MATCH_TYPE_LABEL: Record<string, string> = {
  exact: 'Exact',
  contains: 'Contains',
  regex: 'Pattern (regex)',
};

/** Rules for one category (or all of them), narrowed by a search over the pattern and notes. */
export function filterRules(rules: CategoryMapping[], categoryId: string | null, query: string): CategoryMapping[] {
  const q = query.trim().toLowerCase();
  return rules.filter(
    (r) =>
      (categoryId === null || r.category_id === categoryId) &&
      (!q || r.pattern.toLowerCase().includes(q) || (r.notes ?? '').toLowerCase().includes(q))
  );
}

interface RulesPanelProps {
  rules: CategoryMapping[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Selected category id, or null for all rules. */
  selectedCategoryId: string | null;
  selectedCategoryName: string | null;
  search: string;
  onSearch: (q: string) => void;
  onAdd: () => void;
  onEdit: (rule: CategoryMapping) => void;
  onDelete: (rule: CategoryMapping) => void;
  onApply: (rule: CategoryMapping) => void;
  onShowAll: () => void;
}

export function RulesPanel({
  rules,
  isLoading,
  error,
  onRetry,
  selectedCategoryId,
  selectedCategoryName,
  search,
  onSearch,
  onAdd,
  onEdit,
  onDelete,
  onApply,
  onShowAll,
}: RulesPanelProps) {
  const shown = useMemo(() => filterRules(rules, selectedCategoryId, search), [rules, selectedCategoryId, search]);
  const inCategory = useMemo(() => filterRules(rules, selectedCategoryId, ''), [rules, selectedCategoryId]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="min-w-0 text-[15px] font-semibold text-ink">
          {selectedCategoryId ? (
            <>
              Rules for {selectedCategoryName ?? 'this category'}{' '}
              <button type="button" onClick={onShowAll} className="ml-1 text-[12.5px] font-normal text-accent underline underline-offset-2">
                Show all rules
              </button>
            </>
          ) : (
            'All rules'
          )}
          <span className="fig ml-2 text-[12.5px] font-normal text-ink-3">
            {search.trim() ? `${shown.length} of ${inCategory.length}` : inCategory.length}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-3">
            <Search className="h-3.5 w-3.5" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search patterns"
              aria-label="Search rule patterns"
              className="w-36 bg-transparent text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </label>
          <Button size="sm" onClick={onAdd}>
            Add rule
          </Button>
        </div>
      </div>

      {error && (
        <Notice tone="error" action={<Button size="sm" onClick={onRetry}>Try again</Button>}>
          Couldn&apos;t load rules: {error}
        </Notice>
      )}

      <div className="border-t-[1.5px] border-ink">
        {isLoading ? (
          <div className="py-3">
            <SkeletonRows rows={6} />
          </div>
        ) : shown.length === 0 ? (
          search.trim() ? (
            <EmptyState title="No rules match that search">Rules match on the pattern and the notes.</EmptyState>
          ) : (
            <EmptyState title={selectedCategoryId ? `No rules for ${selectedCategoryName ?? 'this category'} yet` : 'No rules yet'} action={<Button onClick={onAdd}>Add rule</Button>}>
              A rule files matching transactions automatically when they come in.
            </EmptyState>
          )
        ) : (
          <ul aria-label="Rules">
            {shown.map((r) => (
              <li key={r.id} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line-2 py-2.5 text-[13px] last:border-b-0">
                <span className="min-w-0">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <code className="fig max-w-full truncate rounded border border-line-2 bg-sunk px-1.5 py-px text-[12.5px] text-ink">{r.pattern}</code>
                    {r.is_system && <Chip>Policy</Chip>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {MATCH_TYPE_LABEL[r.match_type] ?? r.match_type}
                    {selectedCategoryId === null && <> → {r.category?.name ?? 'Unknown category'}</>}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  {/* Shown on row hover or focus where there is a mouse; always shown on touch screens. */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="[@media(hover:hover)_and_(pointer:fine)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    onClick={() => onApply(r)} aria-label={`Apply ${r.pattern} to existing transactions`}>
                    <span className="sm:hidden">Apply</span>
                    <span className="hidden sm:inline">Apply to existing</span>
                  </Button>
                  <RowMenu
                    label={`Actions for rule ${r.pattern}`}
                    items={[
                      { label: 'Edit rule', onSelect: () => onEdit(r) },
                      { label: 'Delete rule', onSelect: () => onDelete(r), danger: true, hidden: r.is_system },
                    ]}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
