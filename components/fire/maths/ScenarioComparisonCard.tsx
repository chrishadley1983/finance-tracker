'use client';

import { useId, type ReactNode } from 'react';
import { formatCurrency } from '@/lib/fire/maths-calculator';
import type { MathsPlanningScenarioResult } from '@/lib/types/fire';
import { Panel } from '@/components/ui/Panel';
import { MoneyInput } from './MoneyInput';

interface ScenarioComparisonCardProps {
  normal: MathsPlanningScenarioResult;
  fat: MathsPlanningScenarioResult;
  normalFireSpend: number;
  fatFireSpend: number;
  monthlySavings: number;
  onNormalFireSpendChange: (value: number) => void;
  onFatFireSpendChange: (value: number) => void;
  onMonthlySavingsChange: (value: number) => void;
}

/** "6 years 4 months", "8 months", or "never" for an unreachable target. */
export function readableDuration(years: number): string {
  if (!Number.isFinite(years) || years < 0) return 'never at this rate';
  const totalMonths = Math.round(years * 12);
  if (totalMonths === 0) return 'now';
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  const parts = [y > 0 && `${y} year${y === 1 ? '' : 's'}`, m > 0 && `${m} month${m === 1 ? '' : 's'}`].filter(Boolean);
  return parts.join(' ');
}

/** "3y 9m" for tight table cells. */
export function shortDuration(years: number): string {
  if (!Number.isFinite(years) || years < 0) return 'never';
  const total = Math.round(years * 12);
  if (total === 0) return 'now';
  const y = Math.floor(total / 12);
  const m = total % 12;
  return [y > 0 && `${y}y`, m > 0 && `${m}m`].filter(Boolean).join(' ');
}

function Row({ label, hint, normal, fat }: { label: string; hint?: string; normal: ReactNode; fat: ReactNode }) {
  return (
    <tr>
      <th scope="row" className="py-2.5 pr-2 text-left font-normal text-ink-2">
        {label}
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </th>
      <td className="fig py-2.5 pl-3 text-right text-ink">{normal}</td>
      <td className="fig py-2.5 pl-3 text-right text-ink">{fat}</td>
    </tr>
  );
}

function age(n: number) {
  return Number.isFinite(n) ? <span title={n.toFixed(1)}>{Math.floor(n)}</span> : '–';
}

export function ScenarioComparisonCard({
  normal,
  fat,
  normalFireSpend,
  fatFireSpend,
  monthlySavings,
  onNormalFireSpendChange,
  onFatFireSpendChange,
  onMonthlySavingsChange,
}: ScenarioComparisonCardProps) {
  const savingsId = useId();
  return (
    <Panel title="Two targets: comfortable and generous">
      <p className="mb-3 max-w-[75ch] text-[13px] text-ink-2">
        How long each spending level takes to reach, saving{' '}
        <span className="fig">{formatCurrency(monthlySavings)}</span> a month. Change the amounts to compare.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] sm:text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="pb-2 text-left text-[11.5px] font-medium text-ink-3">
                Spending a year
              </th>
              <th scope="col" className="pb-2 pl-3 text-right">
                <span className="mb-1 block text-[12.5px] font-semibold text-ink">Comfortable</span>
                <span className="inline-block">
                  <MoneyInput size="sm" step={1000} value={normalFireSpend} onChange={onNormalFireSpendChange} label="Comfortable spending a year" />
                </span>
              </th>
              <th scope="col" className="pb-2 pl-3 text-right">
                <span className="mb-1 block text-[12.5px] font-semibold text-ink">Generous</span>
                <span className="inline-block">
                  <MoneyInput size="sm" step={1000} value={fatFireSpend} onChange={onFatFireSpendChange} label="Generous spending a year" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-2">
            <Row label="Pot needed" normal={formatCurrency(normal.targetAmount)} fat={formatCurrency(fat.targetAmount)} />
            <Row label="Still to go" normal={formatCurrency(Math.max(0, normal.remaining))} fat={formatCurrency(Math.max(0, fat.remaining))} />
            <Row label="Growth on today's savings" hint="a year, at the expected return" normal={formatCurrency(normal.investmentIncome)} fat={formatCurrency(fat.investmentIncome)} />
            <Row
              label="Time to get there"
              normal={<span title={readableDuration(normal.yearsToSave)}>{shortDuration(normal.yearsToSave)}</span>}
              fat={<span title={readableDuration(fat.yearsToSave)}>{shortDuration(fat.yearsToSave)}</span>}
            />
            <tr>
              <th scope="row" className="py-2.5 pr-4 text-left font-medium text-ink">
                Age when reached
              </th>
              <td className="fig py-2.5 pl-3 text-right text-base font-semibold text-ink">{age(normal.targetAge)}</td>
              <td className="fig py-2.5 pl-3 text-right text-base font-semibold text-ink">{age(fat.targetAge)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1 border-t border-line-2 pt-4">
        <div className="grid gap-1.5">
          <label htmlFor={savingsId} className="text-[13px] font-medium text-ink-2">
            Saving a month
          </label>
          <div className="w-40">
            <MoneyInput id={savingsId} value={monthlySavings} onChange={onMonthlySavingsChange} step={100} />
          </div>
        </div>
        <p className="pb-2 text-xs text-ink-3">
          <span className="fig">{formatCurrency(monthlySavings * 12)}</span> a year
        </p>
      </div>
    </Panel>
  );
}
