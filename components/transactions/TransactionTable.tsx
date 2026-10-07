'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Circle, Pencil, Trash2, Inbox } from 'lucide-react';
import type { TransactionWithRelations } from '@/lib/hooks/useTransactions';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { formatDateGB, formatDayHeading, formatGBP } from '@/lib/format';
import { isTypingTarget } from '@/lib/keyboard';

export interface TransactionWithRunningBalance extends TransactionWithRelations {
  running_balance?: number | null;
}

interface TransactionTableProps {
  transactions: TransactionWithRunningBalance[];
  isLoading: boolean;
  onSort: (column: string) => void;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** Open the detail panel for a row (row click, or Enter on the focused row). */
  onOpen?: (transaction: TransactionWithRelations) => void;
  onDelete?: (transaction: TransactionWithRelations) => void;
  onValidate?: (transaction: TransactionWithRelations) => void;
  onInlineUpdate?: (id: string, field: 'description' | 'category_id', value: string | null) => Promise<void>;
  showRunningBalance?: boolean;
  hideAccountColumn?: boolean;
  /** J/K/X/Enter/Esc row keys. Off while a panel or dialog owns the keyboard. */
  keyboardEnabled?: boolean;
}

/** Money cell text: spending is a plain amount (shown in ink), income gets a leading "+". */
export function formatAmount(amount: number): string {
  return amount > 0 ? formatGBP(amount, { pence: true, signed: true }) : formatGBP(Math.abs(amount), { pence: true });
}

/** A day's net: signed both ways so a mixed day reads unambiguously. */
export function formatNet(amount: number): string {
  return formatGBP(amount, { pence: true, signed: true });
}

function dialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]'));
}

// Grid templates (static strings so Tailwind can see them).
const MOBILE_COLS = 'grid-cols-[1.75rem_minmax(0,1fr)_auto]';
function desktopCols(showAccount: boolean, showBalance: boolean): string {
  if (showAccount && showBalance) return 'md:grid-cols-[2rem_minmax(0,1fr)_9rem_11rem_8rem_8rem_4.5rem]';
  if (showAccount) return 'md:grid-cols-[2rem_minmax(0,1fr)_9rem_11rem_8rem_4.5rem]';
  if (showBalance) return 'md:grid-cols-[2rem_minmax(0,1fr)_11rem_8rem_8rem_4.5rem]';
  return 'md:grid-cols-[2rem_minmax(0,1fr)_11rem_8rem_4.5rem]';
}

function SortButton({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
  align = 'left',
}: {
  column: string;
  label: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  align?: 'left' | 'right';
}) {
  const active = sortColumn === column;
  const Icon = !active ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}`}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md text-xs font-medium uppercase tracking-wide hover:text-ink ${
        active ? 'text-ink' : 'text-ink-3'
      } ${align === 'right' ? 'justify-end' : ''}`}
    >
      <span>{label}</span>
      <Icon className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

// Inline editable description
function EditableDescription({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = async () => {
    const next = editValue.trim();
    if (!next || next === value) {
      onCancel();
      return;
    }
    setIsSaving(true);
    try {
      await onSave(next);
    } catch {
      setEditValue(value);
      onCancel();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      aria-label="Description"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      disabled={isSaving}
      className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    />
  );
}

function SkeletonRow({ cols }: { cols: string }) {
  return (
    <div className={`grid ${MOBILE_COLS} ${cols} animate-pulse items-center gap-x-3 border-b border-line-2 px-3 py-3`}>
      <div className="h-4 w-4 rounded-sm bg-sunk" />
      <div className="h-4 w-48 max-w-full rounded-sm bg-sunk" />
      <div className="h-4 w-16 justify-self-end rounded-sm bg-sunk md:w-24 md:justify-self-start" />
    </div>
  );
}

interface Group {
  key: string;
  date: string | null;
  net: number;
  rows: { t: TransactionWithRunningBalance; index: number }[];
}

export function TransactionTable({
  transactions,
  isLoading,
  onSort,
  sortColumn,
  sortDirection,
  selectedIds = new Set(),
  onSelectionChange,
  onOpen,
  onDelete,
  onValidate,
  onInlineUpdate,
  showRunningBalance = false,
  hideAccountColumn = false,
  keyboardEnabled = true,
}: TransactionTableProps) {
  const hasSelection = onSelectionChange !== undefined;
  const showAccount = !hideAccountColumn;
  const cols = desktopCols(showAccount, showRunningBalance);
  const grouped = sortColumn === 'date';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const anchorRef = useRef<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Forget the focus/anchor when the rows change (new page, filters, sort).
  useEffect(() => {
    anchorRef.current = null;
    setFocusedIndex((i) => (i >= transactions.length ? -1 : i));
  }, [transactions]);

  const groups = useMemo<Group[]>(() => {
    if (!grouped) {
      return [{ key: 'all', date: null, net: 0, rows: transactions.map((t, index) => ({ t, index })) }];
    }
    const out: Group[] = [];
    transactions.forEach((t, index) => {
      const last = out[out.length - 1];
      if (last && last.date === t.date) {
        last.rows.push({ t, index });
        last.net += Number(t.amount);
      } else {
        out.push({ key: `${t.date}-${index}`, date: t.date, net: Number(t.amount), rows: [{ t, index }] });
      }
    });
    return out;
  }, [transactions, grouped]);

  const toggleAt = (index: number, shiftKey: boolean) => {
    if (!onSelectionChange) return;
    const id = transactions[index]?.id;
    if (!id) return;
    const next = new Set(selectedIds);
    const anchor = anchorRef.current;
    if (shiftKey && anchor !== null && anchor < transactions.length) {
      const select = !selectedIds.has(id);
      const [a, b] = anchor < index ? [anchor, index] : [index, anchor];
      for (let i = a; i <= b; i++) {
        if (select) next.add(transactions[i].id);
        else next.delete(transactions[i].id);
      }
    } else if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    anchorRef.current = index;
    onSelectionChange(next);
  };

  const pageSelectedCount = transactions.filter((t) => selectedIds.has(t.id)).length;
  const allSelected = transactions.length > 0 && pageSelectedCount === transactions.length;
  const someSelected = pageSelectedCount > 0 && !allSelected;

  const handleSelectPage = () => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (allSelected) transactions.forEach((t) => next.delete(t.id));
    else transactions.forEach((t) => next.add(t.id));
    onSelectionChange(next);
  };

  const focusRow = (index: number) => {
    setFocusedIndex(index);
    const el = rowRefs.current[index];
    el?.focus();
    el?.scrollIntoView?.({ block: 'nearest' });
  };

  // Keyboard: J/K move, X toggles, Enter opens, Esc clears the selection.
  const stateRef = useRef({ focusedIndex, transactions, selectedIds, onOpen, onSelectionChange, editingId });
  stateRef.current = { focusedIndex, transactions, selectedIds, onOpen, onSelectionChange, editingId };
  const toggleRef = useRef(toggleAt);
  toggleRef.current = toggleAt;

  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target) || dialogOpen()) return;
      const s = stateRef.current;
      if (s.editingId) return;
      const n = s.transactions.length;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (key === 'j' || key === 'k') {
        if (n === 0) return;
        e.preventDefault();
        const from = s.focusedIndex;
        const next = from < 0 ? 0 : Math.min(n - 1, Math.max(0, from + (key === 'j' ? 1 : -1)));
        focusRow(next);
      } else if (key === 'x') {
        if (s.focusedIndex < 0 || s.focusedIndex >= n) return;
        e.preventDefault();
        toggleRef.current(s.focusedIndex, e.shiftKey);
      } else if (key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const onRowOrPage = !target || target === document.body || target.getAttribute?.('role') === 'row';
        if (!onRowOrPage || s.focusedIndex < 0 || s.focusedIndex >= n || !s.onOpen) return;
        e.preventDefault();
        s.onOpen(s.transactions[s.focusedIndex]);
      } else if (key === 'Escape') {
        if (s.selectedIds.size > 0 && s.onSelectionChange) {
          e.preventDefault();
          s.onSelectionChange(new Set());
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboardEnabled]);

  if (!isLoading && transactions.length === 0) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <Inbox className="mb-3 h-10 w-10 text-ink-3" aria-hidden="true" />
          <p className="text-base font-medium text-ink">No transactions found</p>
          <p className="mt-1 text-sm text-ink-3">Try adjusting your filters or search terms</p>
        </div>
      </div>
    );
  }

  const handleRowClick = (e: React.MouseEvent, t: TransactionWithRelations, index: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a, select, textarea, [role="listbox"], [data-row-stop]')) return;
    setFocusedIndex(index);
    onOpen?.(t);
  };

  return (
    <div role="table" aria-label="Transactions" aria-rowcount={transactions.length} className="rounded-md border border-line bg-surface">
      {/* Column headers */}
      <div role="rowgroup">
        <div
          role="row"
          className={`grid ${MOBILE_COLS} ${cols} items-center gap-x-3 rounded-t-md border-b border-line bg-sunk px-3 py-2`}
        >
          <div role="columnheader" className="flex items-center">
            {hasSelection && (
              <input
                type="checkbox"
                aria-label="Select all on this page"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someSelected;
                }}
                onChange={handleSelectPage}
                className="h-4 w-4 accent-accent"
              />
            )}
          </div>
          <div role="columnheader" className="flex items-center gap-3">
            <SortButton column="date" label="Date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            <SortButton column="description" label="Description" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
          </div>
          {showAccount && (
            <div role="columnheader" className="hidden md:block">
              <SortButton column="account" label="Account" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            </div>
          )}
          <div role="columnheader" className="hidden md:block">
            <SortButton column="category" label="Category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
          </div>
          <div role="columnheader" className="flex justify-end">
            <SortButton column="amount" label="Amount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} align="right" />
          </div>
          {showRunningBalance && (
            <div role="columnheader" className="hidden text-right text-xs font-medium uppercase tracking-wide text-ink-3 md:block">
              Balance
            </div>
          )}
          <div role="columnheader" className="hidden md:block">
            <span className="sr-only">Actions</span>
          </div>
        </div>
      </div>

      <div role="rowgroup">
        {isLoading && transactions.length === 0 ? (
          Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} cols={cols} />)
        ) : (
          groups.map((group) => (
            <Fragment key={group.key}>
              {group.date && (
                <div
                  role="row"
                  data-day-heading
                  className="flex items-center justify-between gap-3 border-b border-line-2 bg-ground px-3 py-1.5 text-xs"
                >
                  <span role="rowheader" className="font-medium text-ink-2">
                    {formatDayHeading(group.date)}
                  </span>
                  <span role="cell" className={`fig ${group.net > 0 ? 'text-in' : 'text-ink-3'}`}>
                    <span className="sr-only">Net for the day </span>
                    {formatNet(Math.round(group.net * 100) / 100)}
                  </span>
                </div>
              )}
              {group.rows.map(({ t, index }) => {
                const isSelected = selectedIds.has(t.id);
                const isIncome = t.amount > 0;
                const isEditing = editingId === t.id;
                return (
                  <div
                    key={t.id}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                    role="row"
                    aria-selected={hasSelection ? isSelected : undefined}
                    data-row-index={index}
                    tabIndex={focusedIndex === index || (focusedIndex < 0 && index === 0) ? 0 : -1}
                    onFocus={(e) => {
                      if (e.target === e.currentTarget) setFocusedIndex(index);
                    }}
                    onClick={(e) => handleRowClick(e, t, index)}
                    className={`group grid ${MOBILE_COLS} ${cols} cursor-pointer items-center gap-x-3 border-b border-line-2 px-3 py-2.5 text-sm last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                      isSelected ? 'bg-sel' : 'hover:bg-sunk'
                    } ${isLoading ? 'opacity-60' : ''}`}
                  >
                    {/* Checkbox */}
                    <div role="cell" className="flex items-center">
                      {hasSelection && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${t.description}`}
                          checked={isSelected}
                          readOnly
                          onClick={(e) => toggleAt(index, e.shiftKey)}
                          className="h-4 w-4 accent-accent"
                        />
                      )}
                    </div>

                    {/* Description (+ category/account subline on small screens) */}
                    <div role="cell" className="min-w-0">
                      {isEditing && onInlineUpdate ? (
                        <EditableDescription
                          value={t.description}
                          onSave={async (v) => {
                            await onInlineUpdate(t.id, 'description', v);
                            setEditingId(null);
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="truncate text-ink"
                            title={t.description}
                            onDoubleClick={onInlineUpdate ? () => setEditingId(t.id) : undefined}
                          >
                            {t.description}
                          </span>
                          {t.needs_review && (
                            <span className="shrink-0 rounded-sm bg-warn-soft px-1.5 py-px text-xs text-warn">Review</span>
                          )}
                          {onInlineUpdate && (
                            <button
                              type="button"
                              onClick={() => setEditingId(t.id)}
                              aria-label={`Edit description of ${t.description}`}
                              className="hidden shrink-0 rounded-md p-0.5 text-ink-3 opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100 md:inline-flex"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="mt-0.5 truncate text-xs text-ink-3 md:hidden">
                        {t.category?.name ?? 'Uncategorised'}
                        {showAccount && t.account?.name ? ` · ${t.account.name}` : ''}
                        {!grouped ? ` · ${formatDateGB(t.date)}` : ''}
                      </div>
                      {!grouped && (
                        <div className="mt-0.5 hidden text-xs text-ink-3 md:block">{formatDateGB(t.date)}</div>
                      )}
                    </div>

                    {showAccount && (
                      <div role="cell" className="hidden truncate text-ink-2 md:block">
                        {t.account?.name || '-'}
                      </div>
                    )}

                    {/* Category (inline edit) */}
                    <div role="cell" className="hidden min-w-0 md:block" data-row-stop>
                      {onInlineUpdate ? (
                        <CategorySelect
                          variant="inline"
                          value={t.category_id}
                          allowClear
                          placeholder="Uncategorised"
                          ariaLabel={`Category for ${t.description}`}
                          onChange={(categoryId) => {
                            if (categoryId === t.category_id) return;
                            onInlineUpdate(t.id, 'category_id', categoryId).catch(() => {});
                          }}
                        />
                      ) : (
                        <span className={t.category ? 'text-ink-2' : 'text-ink-3'}>
                          {t.category?.name ?? 'Uncategorised'}
                        </span>
                      )}
                    </div>

                    {/* Amount */}
                    <div role="cell" className={`fig whitespace-nowrap text-right ${isIncome ? 'text-in' : 'text-ink'}`}>
                      {formatAmount(t.amount)}
                    </div>

                    {showRunningBalance && (
                      <div
                        role="cell"
                        className={`fig hidden whitespace-nowrap text-right md:block ${
                          t.running_balance === null || t.running_balance === undefined ? 'text-ink-3' : 'text-ink-2'
                        }`}
                      >
                        {t.running_balance === null || t.running_balance === undefined
                          ? '-'
                          : formatGBP(t.running_balance, { pence: true })}
                      </div>
                    )}

                    {/* Actions */}
                    <div role="cell" className="hidden items-center justify-end gap-0.5 md:flex">
                      {onValidate && (
                        <button
                          type="button"
                          onClick={() => onValidate(t)}
                          aria-pressed={t.is_validated}
                          aria-label={t.is_validated ? 'Mark as unvalidated' : 'Mark as validated'}
                          title={t.is_validated ? 'Validated (click to undo)' : 'Mark as validated'}
                          className={`rounded-md p-1 hover:bg-sunk ${t.is_validated ? 'text-in' : 'text-ink-3 hover:text-ink'}`}
                        >
                          {t.is_validated ? (
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Circle className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(t)}
                          aria-label="Delete transaction"
                          title="Delete transaction"
                          className="rounded-md p-1 text-ink-3 opacity-0 hover:bg-sunk hover:text-ink focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))
        )}
      </div>
    </div>
  );
}
