'use client';

import { useId } from 'react';
import { formatCurrency, formatDate } from '@/lib/fire/maths-calculator';
import { Panel } from '@/components/ui/Panel';
import { MoneyInput } from './MoneyInput';

interface TargetCalculationCardProps {
  fireSpend: number;
  swr: number;
  amountNeeded: number;
  percentOfTarget: number;
  targetRetireDate: Date;
  onFireSpendChange: (value: number) => void;
}

export function TargetCalculationCard({
  fireSpend,
  swr,
  amountNeeded,
  percentOfTarget,
  targetRetireDate,
  onFireSpendChange,
}: TargetCalculationCardProps) {
  const id = useId();
  const progress = Math.max(0, Math.min(percentOfTarget, 100));
  const reached = percentOfTarget >= 100;
  const dateOk = Number.isFinite(targetRetireDate.getTime());

  return (
    <Panel title="Your target">
      <div className="grid gap-1.5">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          Spending a year in retirement
        </label>
        <MoneyInput id={id} value={fireSpend} onChange={onFireSpendChange} step={1000} />
      </div>

      <dl className="mt-3 divide-y divide-line-2 text-sm">
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-ink-2">Pot needed at {swr}% withdrawal</dt>
          <dd className="fig font-medium text-ink">{formatCurrency(amountNeeded)}</dd>
        </div>
        <div className="py-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-2">How far along</dt>
            <dd className="fig font-medium text-ink" title={`${percentOfTarget.toFixed(1)}%`}>
              {Math.round(percentOfTarget)}%
            </dd>
          </div>
          <div
            role="meter"
            aria-label="Progress to target"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="relative mt-2 h-1.5 rounded-full bg-line-2"
          >
            <div className={`absolute inset-y-0 left-0 rounded-full ${reached ? 'bg-accent' : 'bg-ink-2'}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="text-ink-2">Reached around</dt>
          <dd className="font-medium text-ink">{reached ? 'Already reached' : dateOk ? formatDate(targetRetireDate) : 'Not at this rate'}</dd>
        </div>
      </dl>
    </Panel>
  );
}
