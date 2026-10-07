'use client';

import { MoneyInput as BaseMoneyInput } from '@/components/ui/MoneyInput';

/** The shared £ input for the maths tab: an empty field reads as 0. */
export function MoneyInput({
  id,
  value,
  onChange,
  size = 'md',
  label,
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  /** Kept for callers; typing is free-form so there's no stepper. */
  step?: number;
  size?: 'sm' | 'md';
  /** aria-label when there's no visible label. */
  label?: string;
}) {
  return (
    <BaseMoneyInput
      id={id}
      value={Number.isFinite(value) ? value : null}
      onChange={(v) => onChange(v ?? 0)}
      size={size}
      align="right"
      label={label}
      className={size === 'sm' ? 'w-28 sm:w-32' : ''}
    />
  );
}
