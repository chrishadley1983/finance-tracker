'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Search, X } from 'lucide-react';
import type { FilterState, TransactionStatusFilter } from '@/lib/hooks/useTransactions';
import { useAccounts } from '@/lib/hooks/useAccounts';
import { useCategories, categoryGroupName, type CategoryWithGroup } from '@/lib/hooks/useCategories';
import { MONTH_SHORT } from '@/lib/format';
import { hasActiveFilters } from '@/lib/transactions/url-filters';

// Account types that can have transactions
export const TRANSACTION_ACCOUNT_TYPES = ['current', 'savings', 'credit'];

interface TransactionFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const STATUS_OPTIONS: { value: TransactionStatusFilter | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'uncategorised', label: 'Needs category' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'validated', label: 'Validated' },
];

const chipBase =
  'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const chipIdle = 'border-line bg-surface text-ink-2 hover:bg-sunk';
const chipOn = 'border-accent bg-accent-soft text-ink';

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function shortDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  const thisYear = new Date().getFullYear();
  return `${d} ${MONTH_SHORT[m - 1]}${y === thisYear ? '' : ` ${y}`}`;
}

function dateLabel(from?: string, to?: string): string {
  if (from && to) return `${shortDate(from)} – ${shortDate(to)}`;
  if (from) return `From ${shortDate(from)}`;
  if (to) return `Until ${shortDate(to)}`;
  return 'Date';
}

function datePresets(now = new Date()): { label: string; from: string; to: string }[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const thirty = new Date(now);
  thirty.setDate(thirty.getDate() - 29);
  return [
    { label: 'This month', from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) },
    { label: 'Last month', from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    { label: 'Last 30 days', from: iso(thirty), to: iso(now) },
    { label: 'This year', from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) },
    { label: 'Last year', from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)) },
  ];
}

function DateChip({ from, to, onChange }: { from?: string; to?: string; onChange: (from?: string, to?: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = Boolean(from || to);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${chipBase} ${active ? chipOn : chipIdle}`}
      >
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{dateLabel(from, to)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="group"
          aria-label="Date range"
          className="absolute left-0 z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-surface p-3 shadow-lg"
        >
          <div className="flex flex-wrap gap-1.5">
            {datePresets().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  onChange(p.from, p.to);
                  setOpen(false);
                }}
                className={`${chipBase} h-7 px-2 text-xs ${from === p.from && to === p.to ? chipOn : chipIdle}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-ink-3">
              From
              <input
                type="date"
                value={from || ''}
                onChange={(e) => onChange(e.target.value || undefined, to)}
                className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            <label className="text-xs text-ink-3">
              To
              <input
                type="date"
                value={to || ''}
                onChange={(e) => onChange(from, e.target.value || undefined)}
                className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
          </div>
          {active && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined, undefined);
                setOpen(false);
              }}
              className="mt-3 text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              Any date
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A native <select> dressed as a filter chip (works well on touch screens). */
function SelectChip({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${chipBase} max-w-[14rem] appearance-none truncate pr-7 ${value ? chipOn : chipIdle} disabled:opacity-60`}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
        aria-hidden="true"
      />
    </div>
  );
}

export function TransactionFilters({ filters, onChange }: TransactionFiltersProps) {
  const { data: accountData, isLoading: isLoadingAccounts } = useAccounts();
  const { data: categories, isLoading: isLoadingCategories } = useCategories();

  // Only show accounts that can have transactions
  const accounts = useMemo(
    () => (accountData ?? []).filter((account) => TRANSACTION_ACCOUNT_TYPES.includes(account.type)),
    [accountData]
  );

  // Group categories by group name (prefer category_groups relationship over legacy group_name)
  const categoriesByGroup = useMemo(
    () =>
      (categories ?? []).reduce((acc, category) => {
        const groupName = categoryGroupName(category);
        (acc[groupName] ??= []).push(category);
        return acc;
      }, {} as Record<string, CategoryWithGroup[]>),
    [categories]
  );

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search. "/" is the app-wide palette key, so no shortcut here. */}
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search transactions"
          placeholder="Search description..."
          value={filters.search || ''}
          onChange={(e) => set({ search: e.target.value || undefined })}
          className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-2.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <DateChip
        from={filters.dateFrom}
        to={filters.dateTo}
        onChange={(dateFrom, dateTo) => set({ dateFrom, dateTo })}
      />

      <SelectChip
        label="Account"
        value={filters.accountId || ''}
        disabled={isLoadingAccounts}
        onChange={(v) => set({ accountId: v || undefined })}
      >
        <option value="">Any account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </SelectChip>

      <SelectChip
        label="Category"
        value={filters.categoryId || ''}
        disabled={isLoadingCategories}
        onChange={(v) => set({ categoryId: v || undefined })}
      >
        <option value="">Any category</option>
        {Object.entries(categoriesByGroup).map(([groupName, groupCategories]) => (
          <optgroup key={groupName} label={groupName}>
            {groupCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectChip>

      <div role="group" aria-label="Status" className="inline-flex flex-wrap gap-1">
        {STATUS_OPTIONS.map((opt) => {
          const on = filters.status === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              aria-pressed={on}
              onClick={() => set({ status: opt.value, validated: undefined })}
              className={`${chipBase} ${on ? chipOn : chipIdle}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-ink-2 hover:bg-sunk hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  );
}
