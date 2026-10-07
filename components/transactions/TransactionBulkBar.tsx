'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Check, Flag, FlagOff, Trash2, Wand2, X } from 'lucide-react';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { formatGBP } from '@/lib/format';

export interface TransactionBulkBarProps {
  count: number;
  /** Sum of the selected amounts. */
  amount: number;
  busy?: boolean;
  /** Every selected row is flagged for review: offer "Clear flag". */
  allFlagged: boolean;
  /** Shared merchant key of the selection, or null when they differ. */
  merchant: string | null;
  /** Shared category of the selection (pre-selects "Make a rule"). */
  commonCategoryId: string | null;
  accounts: { id: string; name: string }[];
  onSetCategory: (categoryId: string) => void;
  onMarkValidated: () => void;
  onToggleFlag: () => void;
  onMove: (accountId: string) => void;
  onMakeRule: (categoryId: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

const barBtn =
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-bar-ink hover:bg-ink-2/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50';

function MoveMenu({
  accounts,
  disabled,
  onMove,
}: {
  accounts: { id: string; name: string }[];
  disabled?: boolean;
  onMove: (accountId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={barBtn}
      >
        <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        Move to account
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Move to account"
          className="absolute bottom-full left-0 z-50 mb-1 max-h-72 w-60 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          {accounts.length === 0 ? (
            <p className="px-3 py-1.5 text-sm text-ink-3">No accounts</p>
          ) : (
            accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onMove(a.id);
                }}
                className="block w-full truncate px-3 py-1.5 text-left text-sm text-ink hover:bg-sel"
              >
                {a.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Sticky action bar shown while rows are selected. */
export function TransactionBulkBar({
  count,
  amount,
  busy = false,
  allFlagged,
  merchant,
  commonCategoryId,
  accounts,
  onSetCategory,
  onMarkValidated,
  onToggleFlag,
  onMove,
  onMakeRule,
  onDelete,
  onClear,
}: TransactionBulkBarProps) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-3 z-30 flex flex-wrap items-center gap-x-1 gap-y-1 rounded-md bg-bar px-2 py-1.5 text-bar-ink"
    >
      <span className="px-2 text-sm">
        <span className="fig font-medium">{count.toLocaleString('en-GB')}</span> selected
        <span className="opacity-70"> · </span>
        <span className="fig">{formatGBP(amount, { pence: true })}</span>
      </span>

      <CategorySelect
        variant="button"
        value={null}
        onChange={(id) => id && onSetCategory(id)}
        buttonLabel="Set category"
        ariaLabel="Set category"
        placement="top"
        disabled={busy}
      />

      <button type="button" onClick={onMarkValidated} disabled={busy} className={barBtn}>
        <Check className="h-4 w-4" aria-hidden="true" />
        Mark validated
      </button>

      <button type="button" onClick={onToggleFlag} disabled={busy} className={barBtn}>
        {allFlagged ? <FlagOff className="h-4 w-4" aria-hidden="true" /> : <Flag className="h-4 w-4" aria-hidden="true" />}
        {allFlagged ? 'Clear flag' : 'Flag for review'}
      </button>

      <MoveMenu accounts={accounts} disabled={busy} onMove={onMove} />

      {merchant && (
        <CategorySelect
          variant="button"
          value={commonCategoryId}
          onChange={(id) => id && onMakeRule(id)}
          buttonLabel={
            <>
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              Make a rule
            </>
          }
          ariaLabel={`Make a rule for ${merchant}`}
          placement="top"
          disabled={busy}
          buttonClassName="bg-transparent text-bar-ink hover:bg-ink-2/40"
        />
      )}

      <button type="button" onClick={onDelete} disabled={busy} className={barBtn}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
      </button>

      <button type="button" onClick={onClear} aria-label="Clear selection" className={`${barBtn} ml-auto`}>
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
