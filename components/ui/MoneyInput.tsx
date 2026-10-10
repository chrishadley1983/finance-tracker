'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { controlClass } from '@/components/ui/Field';

/* ---- Pure helpers -------------------------------------------------------- */

/**
 * How an amount reads when the field isn't being edited: thousands separators,
 * and pence only when there are some ("416,085.32", "97,520"). Display only;
 * the value itself is never rounded.
 */
export function formatMoneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const hasPence = Math.round(Math.abs(value) * 100) % 100 !== 0;
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: hasPence ? 2 : 0,
    maximumFractionDigits: hasPence ? 2 : 0,
  });
}

/**
 * Read what was typed: "£1,250.50", "1250.5", " 97520 ". Returns null for an
 * empty field and undefined for something that isn't a number yet (e.g. "-").
 */
export function parseMoneyInput(raw: string): number | null | undefined {
  const cleaned = raw.replace(/[£,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** The raw value shown while editing: exactly what is stored, no separators. */
export function rawMoneyInput(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '' : String(value);
}

/* ---- Components ---------------------------------------------------------- */

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size' | 'prefix'>;

interface MoneyInputProps extends BaseProps {
  value: number | null;
  /** Called with the typed amount (null when cleared). Never rounded. */
  onChange: (value: number | null) => void;
  /** `sm` for table cells and compact rows. */
  size?: 'sm' | 'md';
  /** Right-align in tables and columns of figures. */
  align?: 'left' | 'right';
  /** aria-label when there's no visible label. */
  label?: string;
  /** Classes for the wrapper (e.g. a width). */
  className?: string;
  /** Extra classes for the input itself. */
  inputClassName?: string;
}

/**
 * A £ amount: shows "£ 416,085.32" at rest and the raw number while editing,
 * set in the figures face. The one money field used across the app.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, size = 'md', align = 'left', label, className = '', inputClassName = '', onFocus, onBlur, ...rest },
  ref
) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatMoneyInput(value);

  return (
    <div className={`relative ${className}`}>
      <span
        aria-hidden
        className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 ${size === 'sm' ? 'text-[12.5px]' : 'text-[13px]'}`}
      >
        £
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        {...rest}
        value={shown}
        onFocus={(e) => {
          setDraft(rawMoneyInput(value));
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setDraft(null);
          onBlur?.(e);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseMoneyInput(e.target.value);
          if (parsed !== undefined) onChange(parsed);
        }}
        className={`${controlClass} fig pl-6 ${align === 'right' ? 'text-right' : ''} ${size === 'sm' ? 'h-8 py-1 text-[13px]' : ''} ${inputClassName}`}
      />
    </div>
  );
});

interface NumberInputProps extends BaseProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Unit after the number, e.g. "%" or "years". */
  suffix?: string;
  align?: 'left' | 'right';
  className?: string;
  inputClassName?: string;
}

/** Ages, percentages and other plain figures, in the figures face with an optional unit. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onChange, suffix, align = 'left', className = '', inputClassName = '', ...rest },
  ref
) {
  return (
    <div className={`relative ${className}`}>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        {...rest}
        value={value === null || !Number.isFinite(value) ? '' : value}
        onChange={(e) => {
          const n = e.target.value === '' ? null : Number(e.target.value);
          if (n === null || Number.isFinite(n)) onChange(n);
        }}
        className={`${controlClass} fig ${align === 'right' ? 'text-right' : ''} ${suffix ? `${suffix.length > 1 ? 'pr-14' : 'pr-7'} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none` : ''} ${inputClassName}`}
      />
      {suffix && (
        <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">
          {suffix}
        </span>
      )}
    </div>
  );
});
