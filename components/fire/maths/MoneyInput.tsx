'use client';

import { controlClass } from '@/components/ui/Field';

/** A £ amount input using the shared control style; empty or invalid reads as 0. */
export function MoneyInput({
  id,
  value,
  onChange,
  step = 100,
  size = 'md',
  label,
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  size?: 'sm' | 'md';
  /** aria-label when there's no visible label. */
  label?: string;
}) {
  return (
    <div className={`relative ${size === 'sm' ? 'w-24 sm:w-28' : ''}`}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">£</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
        step={step}
        min={0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`${controlClass} fig pl-6 text-right ${size === 'sm' ? 'h-8 py-1 text-[13px]' : ''}`}
      />
    </div>
  );
}
