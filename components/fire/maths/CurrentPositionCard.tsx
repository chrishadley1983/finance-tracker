'use client';

import { useId } from 'react';
import { formatCurrency } from '@/lib/fire/maths-calculator';
import { formatDateGB } from '@/lib/format';
import { Panel } from '@/components/ui/Panel';

interface CurrentPositionCardProps {
  currentAge: number;
  dateOfBirth: string | null;
  currentSavings: number;
  propertyValue: number;
  expectedReturn: number;
  swr: number;
  onExpectedReturnChange: (value: number) => void;
  onSwrChange: (value: number) => void;
}

export function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        <span className="fig text-sm font-medium text-ink">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
      <div className="flex justify-between text-[11.5px] text-ink-3">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

export function CurrentPositionCard({
  currentAge,
  dateOfBirth,
  currentSavings,
  propertyValue,
  expectedReturn,
  swr,
  onExpectedReturnChange,
  onSwrChange,
}: CurrentPositionCardProps) {
  return (
    <Panel title="Where you are now">
      <dl className="divide-y divide-line-2 text-sm">
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-ink-2">Age</dt>
          <dd className="text-right">
            <span className="fig text-ink" title={currentAge.toFixed(2)}>
              {Math.floor(currentAge)}
            </span>
            {dateOfBirth && <span className="block text-xs text-ink-3">born {formatDateGB(dateOfBirth)}</span>}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-ink-2">Savings and investments</dt>
          <dd className="fig text-ink">{formatCurrency(currentSavings)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-ink-2">
            Property
            <span className="block text-xs text-ink-3">not counted towards FIRE</span>
          </dt>
          <dd className="fig text-ink-3">{formatCurrency(propertyValue)}</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-4 border-t border-line-2 pt-4">
        <Slider label="Growth a year, after inflation" value={expectedReturn} display={`${expectedReturn}%`} min={0} max={12} step={0.5} onChange={onExpectedReturnChange} />
        <Slider label="Withdrawal rate" value={swr} display={`${swr}%`} min={2} max={6} step={0.25} onChange={onSwrChange} />
      </div>
    </Panel>
  );
}
