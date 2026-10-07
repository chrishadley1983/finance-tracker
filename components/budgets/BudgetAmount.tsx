'use client';

import { useEffect, useRef, useState } from 'react';
import { formatGBP } from '@/lib/format';

/** "£1,250.50", "1250", "" (= 0) -> number; null when not a valid amount. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, '');
  if (cleaned === '') return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

interface BudgetAmountProps {
  amount: number;
  /** Category name, for the accessible label. */
  name: string;
  /** Called with the new amount when an edit is committed with a different value. */
  onSave?: (amount: number) => void;
  /** When given, clicking opens another editor (e.g. the 12-month panel) instead of editing in place. */
  onOpen?: () => void;
  /** Words for the period in labels, e.g. "October" or "2026". */
  periodWords: string;
}

/**
 * A budget figure you can click to change. Enter saves, Escape cancels,
 * clicking away saves. Works by tap as well as mouse; no hover-only controls.
 */
export function BudgetAmount({ amount, name, onSave, onOpen, periodWords }: BudgetAmountProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    if (onOpen) return onOpen();
    done.current = false;
    setDraft(amount ? String(amount) : '');
    setInvalid(false);
    setEditing(true);
  };

  const close = () => {
    done.current = true;
    setEditing(false);
    // Return focus to the figure so keyboard users keep their place.
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const commit = (fromBlur = false) => {
    if (done.current) return;
    const value = parseAmount(draft);
    if (value === null) {
      if (fromBlur) return close(); // clicking away from a bad value abandons it
      setInvalid(true);
      return;
    }
    close();
    if (value !== amount) onSave?.(value);
  };

  if (editing) {
    return (
      <span className="inline-flex flex-col items-end">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          onBlur={() => commit(true)}
          inputMode="decimal"
          autoFocus
          aria-label={`Budget for ${name} in ${periodWords}`}
          aria-invalid={invalid || undefined}
          className={`fig h-7 w-24 rounded-md border bg-surface px-2 text-right text-[13px] text-ink focus:outline-none focus:ring-1 ${
            invalid ? 'border-bad focus:ring-bad' : 'border-accent focus:ring-accent'
          }`}
        />
        {invalid && <span className="mt-0.5 text-[11.5px] text-bad">Enter an amount, e.g. 250</span>}
      </span>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={start}
      aria-label={`${onOpen ? 'Edit monthly budgets' : 'Edit budget'} for ${name}, ${formatGBP(amount)} in ${periodWords}`}
      className="fig -mx-1 rounded px-1 py-1 text-ink underline decoration-line decoration-dashed underline-offset-4 hover:bg-sunk hover:decoration-ink-3 focus-visible:outline-2 focus-visible:outline-accent"
    >
      {formatGBP(amount)}
    </button>
  );
}
