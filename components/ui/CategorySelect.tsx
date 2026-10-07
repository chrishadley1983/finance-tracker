'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useCategories, categoryGroupName, type CategoryWithGroup } from '@/lib/hooks/useCategories';

export interface CategorySelectProps {
  /** Selected category id, or null for none. */
  value: string | null;
  /** Called with the chosen id and category, or (null, null) when cleared. */
  onChange: (categoryId: string | null, category: CategoryWithGroup | null) => void;
  /** Text shown in the field trigger when nothing is selected. */
  placeholder?: string;
  /** Offer a "No category" option that clears the value. */
  allowClear?: boolean;
  /** Focus the control and open the list on mount (e.g. inline editing). */
  autoFocus?: boolean;
  /**
   * 'field' (default): full-width input-like trigger showing the selection.
   * 'button': compact action button showing `buttonLabel` (e.g. bulk "Categorise").
   * 'inline': borderless text trigger for table cells (shows the selection).
   */
  variant?: 'field' | 'button' | 'inline';
  /** Content of the 'button' variant trigger. */
  buttonLabel?: ReactNode;
  /** Accessible name for the trigger. Defaults to "Category". */
  ariaLabel?: string;
  /** Override the category source; defaults to the shared useCategories() cache. */
  categories?: CategoryWithGroup[];
  disabled?: boolean;
  /** Horizontal alignment of the popover relative to the trigger. */
  align?: 'left' | 'right';
  /** Open the list below (default) or above the trigger (e.g. in a bottom bar). */
  placement?: 'bottom' | 'top';
  /** Extra classes for the 'button' variant trigger (overrides its colours). */
  buttonClassName?: string;
  className?: string;
  /** Replace the trigger's default styling (e.g. a quiet chip in a table row). */
  triggerClassName?: string;
}

interface Group {
  name: string;
  options: CategoryWithGroup[];
}

const CLEAR_KEY = '__clear__';

function groupCategories(categories: CategoryWithGroup[], query: string): Group[] {
  const q = query.trim().toLowerCase();
  const groups = new Map<string, CategoryWithGroup[]>();
  for (const cat of categories) {
    const group = categoryGroupName(cat);
    if (q && !cat.name.toLowerCase().includes(q) && !group.toLowerCase().includes(q)) continue;
    const list = groups.get(group);
    if (list) list.push(cat);
    else groups.set(group, [cat]);
  }
  return Array.from(groups, ([name, options]) => ({ name, options }));
}

export function CategorySelect({
  value,
  onChange,
  placeholder = 'Select category',
  allowClear = false,
  autoFocus = false,
  variant = 'field',
  buttonLabel = 'Categorise',
  ariaLabel = 'Category',
  categories: categoriesProp,
  disabled = false,
  align = 'left',
  placement = 'bottom',
  buttonClassName,
  className = '',
  triggerClassName,
}: CategorySelectProps) {
  const { data, isLoading } = useCategories({ enabled: !categoriesProp });
  const categories = useMemo(() => categoriesProp ?? data ?? [], [categoriesProp, data]);
  const loading = !categoriesProp && isLoading && categories.length === 0;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (key: string) => `${baseId}-opt-${key}`;

  const selected = useMemo(
    () => (value ? categories.find((c) => c.id === value) ?? null : null),
    [categories, value]
  );

  const groups = useMemo(() => groupCategories(categories, query), [categories, query]);

  // Flat option list in display order, for keyboard navigation.
  const flat = useMemo(() => {
    const items: (CategoryWithGroup | null)[] = [];
    if (allowClear && !query.trim()) items.push(null);
    for (const g of groups) items.push(...g.options);
    return items;
  }, [allowClear, groups, query]);

  const activeItem = flat[activeIndex];
  const activeKey = activeItem === undefined ? undefined : activeItem ? activeItem.id : CLEAR_KEY;

  const openList = (initialQuery = '') => {
    if (disabled) return;
    setQuery(initialQuery);
    setOpen(true);
  };

  const close = (returnFocus = true) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) triggerRef.current?.focus();
  };

  const select = (item: CategoryWithGroup | null) => {
    onChange(item ? item.id : null, item);
    close();
  };

  // On open: focus the search box and highlight the current value.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  // Reset the highlight whenever the list contents change.
  useEffect(() => {
    if (!open) return;
    const idx = query.trim() ? 0 : flat.findIndex((c) => (c ? c.id === value : false));
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, query]);

  // Keep the active option visible.
  useEffect(() => {
    if (!open || !activeKey) return;
    const el = document.getElementById(optionId(activeKey));
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeKey]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // autoFocus: focus the trigger and open the list on mount.
  useEffect(() => {
    if (!autoFocus) return;
    triggerRef.current?.focus();
    openList();
  }, []);

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openList();
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Type-to-search straight from the closed trigger.
      e.preventDefault();
      openList(e.key);
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(Math.max(flat.length - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeItem !== undefined) select(activeItem);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // don't also close an enclosing dialog
        close();
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const optionClass = (isActive: boolean) =>
    `flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
      isActive ? 'bg-sel text-ink' : 'text-ink'
    }`;

  const triggerContent =
    variant === 'button' ? (
      <>
        {buttonLabel}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </>
    ) : variant === 'inline' ? (
      <span className={`truncate ${selected ? 'text-ink-2' : 'text-ink-3'}`}>
        {selected ? selected.name : loading ? 'Loading...' : placeholder}
      </span>
    ) : (
      <>
        <span className={`truncate ${selected ? 'text-ink' : 'text-ink-3'}`}>
          {selected ? selected.name : loading ? 'Loading...' : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
      </>
    );

  const triggerClass =
    triggerClassName ??
    (variant === 'button'
      ? `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
          buttonClassName ?? 'bg-accent text-accent-ink'
        }`
      : variant === 'inline'
      ? 'flex max-w-full items-center rounded-md px-1.5 py-0.5 -mx-1.5 text-left text-sm hover:bg-sunk focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed'
      : 'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-sunk');

  return (
    <div ref={rootRef} className={`relative ${variant === 'field' ? 'w-full' : variant === 'inline' ? 'block min-w-0' : 'inline-block max-w-full'} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={variant !== 'button' && selected ? `${ariaLabel}: ${selected.name}` : ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        className={triggerClass}
      >
        {triggerContent}
      </button>

      {open && (
        <div
          className={`absolute z-50 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-line bg-surface shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${placement === 'top' ? 'bottom-full mb-1' : 'mt-1'}`}
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label={`Search ${ariaLabel.toLowerCase()}`}
              aria-expanded={true}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeKey ? optionId(activeKey) : undefined}
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Type to filter..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </div>

          <div id={listboxId} role="listbox" aria-label={ariaLabel} className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-2 text-sm text-ink-3">Loading...</div>
            ) : flat.length === 0 ? (
              <div className="px-3 py-2 text-sm text-ink-3">No categories found</div>
            ) : (
              <>
                {allowClear && !query.trim() && (
                  <div
                    id={optionId(CLEAR_KEY)}
                    role="option"
                    aria-selected={value === null}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(null)}
                    onMouseEnter={() => setActiveIndex(0)}
                    className={optionClass(activeKey === CLEAR_KEY)}
                  >
                    <span className="inline-flex items-center gap-1.5 italic text-ink-3">
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      No category
                    </span>
                  </div>
                )}
                {groups.map((group) => {
                  const headingId = `${baseId}-grp-${group.name.replace(/\W+/g, '-')}`;
                  return (
                    <div key={group.name} role="group" aria-labelledby={headingId}>
                      <div
                        id={headingId}
                        className="sticky top-0 bg-sunk px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-3"
                      >
                        {group.name}
                      </div>
                      {group.options.map((cat) => {
                        const isSelected = cat.id === value;
                        return (
                          <div
                            key={cat.id}
                            id={optionId(cat.id)}
                            role="option"
                            aria-selected={isSelected}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => select(cat)}
                            onMouseEnter={() => setActiveIndex(flat.indexOf(cat))}
                            className={optionClass(activeKey === cat.id)}
                          >
                            <span className="truncate">{cat.name}</span>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
