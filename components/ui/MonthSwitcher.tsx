'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTH_NAMES, MONTH_SHORT } from '@/lib/format';

/* ---- Month keys (YYYY-MM), pure ---------------------------------------- */

const KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(s: string | null | undefined): s is string {
  return !!s && KEY.test(s);
}

function parts(key: string): [number, number] {
  const [y, m] = key.split('-').map(Number);
  return [y, m];
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Shift a YYYY-MM key by n months. */
export function shiftMonthKey(key: string, n: number): string {
  const [y, m] = parts(key);
  const i = y * 12 + (m - 1) + n;
  return toMonthKey(Math.floor(i / 12), (i % 12) + 1);
}

/** "October 2026". */
export function monthKeyLabel(key: string): string {
  const [y, m] = parts(key);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Whether a month lies inside the optional limits (keys compare as strings). */
export function inMonthRange(key: string, min?: string, max?: string): boolean {
  return (!min || key >= min) && (!max || key <= max);
}

/* ---- Component ----------------------------------------------------------- */

interface MonthSwitcherProps {
  /** The month shown, YYYY-MM. */
  value: string;
  onChange: (month: string) => void;
  /** Earliest month that can be chosen (YYYY-MM). */
  min?: string;
  /** Latest month that can be chosen (YYYY-MM); next is disabled past it. */
  max?: string;
  /** Text size of the month name: `lg` for a page heading, `md` inside a section. */
  size?: 'md' | 'lg';
  /** Where the picker opens, relative to the label. */
  align?: 'start' | 'center' | 'end';
  /** Name for the control as a whole, read by screen readers. */
  ariaLabel?: string;
  /** Suffix for the next button's label when it's disabled by `max`. */
  maxReason?: string;
  className?: string;
}

const arrow =
  'grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-3';

/**
 * ‹ October 2026 ›: step a month at a time, or select the name to pick any
 * month from a small year grid. The one month control used on every page.
 */
export function MonthSwitcher({
  value,
  onChange,
  min,
  max,
  size = 'lg',
  align = 'start',
  ariaLabel = 'Month',
  maxReason = 'not started yet',
  className = '',
}: MonthSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => parts(value)[0]);
  const [focusMonth, setFocusMonth] = useState(() => parts(value)[1]);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pickerId = useId();
  /** Move focus into the grid on the next render (on open and arrow-key moves, not year clicks). */
  const wantFocus = useRef(false);

  const prev = shiftMonthKey(value, -1);
  const next = shiftMonthKey(value, 1);
  const prevOk = inMonthRange(prev, min, undefined);
  const nextOk = inMonthRange(next, undefined, max);
  const minYear = min ? parts(min)[0] : -Infinity;
  const maxYear = max ? parts(max)[0] : Infinity;

  const [vy, vm] = parts(value);
  // The month that takes Tab focus in the grid: the active one, or the first that can be chosen.
  const tabMonth = inMonthRange(toMonthKey(year, focusMonth), min, max)
    ? focusMonth
    : ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => inMonthRange(toMonthKey(year, m), min, max)) ?? focusMonth);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openPicker = () => {
    const [y, m] = parts(value);
    setYear(y);
    setFocusMonth(m);
    wantFocus.current = true;
    setOpen(true);
  };

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  useEffect(() => {
    if (!open || !wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]:not(:disabled)')?.focus();
  });

  const choose = (key: string) => {
    if (!inMonthRange(key, min, max)) return;
    close();
    if (key !== value) onChange(key);
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    if (e.key in moves) {
      e.preventDefault();
      const target = shiftMonthKey(toMonthKey(year, tabMonth), moves[e.key]);
      if (!inMonthRange(target, min, max)) return;
      const [y, m] = parts(target);
      wantFocus.current = true;
      setYear(y);
      setFocusMonth(m);
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const y = year + (e.key === 'PageUp' ? -1 : 1);
      if (y < minYear || y > maxYear) return;
      wantFocus.current = true;
      setYear(y);
    }
  };

  const onRootKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    }
  };

  const labelText = monthKeyLabel(value);
  const textSize = size === 'lg' ? 'text-lg tracking-tight' : 'text-[15px]';
  const place = align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0';

  return (
    <div ref={rootRef} role="group" aria-label={ariaLabel} onKeyDown={onRootKey} className={`relative inline-flex items-center gap-0.5 ${className}`}>
      <button
        type="button"
        className={arrow}
        onClick={() => onChange(prev)}
        disabled={!prevOk}
        aria-label={`Previous month, ${monthKeyLabel(prev)}`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? pickerId : undefined}
        aria-label={`${labelText}. Choose a month`}
        className={`min-w-[9.5rem] rounded-md px-2 py-1 text-center font-semibold text-ink hover:bg-line-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${textSize}`}
      >
        <time dateTime={value}>{labelText}</time>
      </button>
      <span className="sr-only" aria-live="polite">
        {labelText}
      </span>

      <button
        type="button"
        className={arrow}
        onClick={() => onChange(next)}
        disabled={!nextOk}
        aria-label={nextOk ? `Next month, ${monthKeyLabel(next)}` : `Next month, ${monthKeyLabel(next)} (${maxReason})`}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          id={pickerId}
          role="dialog"
          aria-label="Choose a month"
          className={`absolute top-full z-40 mt-1.5 w-[15.5rem] rounded-md border border-line bg-surface p-2 shadow-lg ${place}`}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              className={arrow}
              onClick={() => setYear((y) => y - 1)}
              disabled={year - 1 < minYear}
              aria-label={`Previous year, ${year - 1}`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="fig text-sm font-semibold text-ink" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              className={arrow}
              onClick={() => setYear((y) => y + 1)}
              disabled={year + 1 > maxYear}
              aria-label={`Next year, ${year + 1}`}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div ref={gridRef} role="grid" aria-label={`Months of ${year}`} onKeyDown={onGridKey} className="grid grid-cols-3 gap-1">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} role="row" className="contents">
                {[1, 2, 3].map((col) => {
                  const m = row * 3 + col;
                  const key = toMonthKey(year, m);
                  const selected = year === vy && m === vm;
                  const allowed = inMonthRange(key, min, max);
                  return (
                    <span key={m} role="gridcell" aria-selected={selected} className="contents">
                      <button
                        type="button"
                        data-month={m}
                        tabIndex={m === tabMonth ? 0 : -1}
                        disabled={!allowed}
                        onClick={() => choose(key)}
                        onFocus={() => setFocusMonth(m)}
                        aria-label={monthKeyLabel(key)}
                        aria-current={selected ? 'date' : undefined}
                        className={`h-9 rounded-md text-[13.5px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-ink-3 disabled:opacity-50 ${
                          selected ? 'bg-accent font-semibold text-accent-ink' : 'text-ink hover:bg-line-2'
                        }`}
                      >
                        {MONTH_SHORT[m - 1]}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
