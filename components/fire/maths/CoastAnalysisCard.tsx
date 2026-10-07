'use client';

import { useId } from 'react';
import { formatCurrency } from '@/lib/fire/maths-calculator';
import type { MathsPlanningCoastResult } from '@/lib/types/fire';
import { Panel } from '@/components/ui/Panel';
import { controlClass } from '@/components/ui/Field';
import { MoneyInput } from './MoneyInput';

interface CoastAnalysisCardProps {
  coastNow: MathsPlanningCoastResult;
  coastAfterMinFire: MathsPlanningCoastResult;
  coastTargetAge: number;
  coastCurrentSpend: number;
  coastMonthlySavings: number;
  onCoastTargetAgeChange: (value: number) => void;
  onCoastCurrentSpendChange: (value: number) => void;
  onCoastMonthlySavingsChange: (value: number) => void;
}

function CoastColumn({ title, explain, result }: { title: string; explain: string; result: MathsPlanningCoastResult }) {
  return (
    <div className="min-w-0">
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 text-xs text-ink-3">{explain}</p>
      <dl className="mt-2 divide-y divide-line-2 text-sm">
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-2">Saving a month</dt>
          <dd className="fig text-ink">{formatCurrency(result.savingPerMonth)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-2">Pre-tax earnings needed</dt>
          <dd className="fig text-ink">{formatCurrency(result.postTaxEarningsRequired)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-2">Pot at {result.retireAge}</dt>
          <dd className="fig text-ink">{formatCurrency(result.portfolioAtCoastAge)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2">
          <dt className="font-medium text-ink">
            Spending it supports
            <span className="block text-xs font-normal text-ink-3">a year from {result.retireAge}, at {result.swr}%</span>
          </dt>
          <dd className="fig text-lg font-semibold text-ink">{formatCurrency(result.fireSpendAtCoastAge)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function CoastAnalysisCard({
  coastNow,
  coastAfterMinFire,
  coastTargetAge,
  coastCurrentSpend,
  coastMonthlySavings,
  onCoastTargetAgeChange,
  onCoastCurrentSpendChange,
  onCoastMonthlySavingsChange,
}: CoastAnalysisCardProps) {
  const ageId = useId();
  const spendId = useId();
  const saveId = useId();
  return (
    <Panel title="Coasting: saving less from now on">
      <p className="mb-3 max-w-[75ch] text-[13px] text-ink-2">
        What your pot could support at {coastTargetAge} if you eased off saving, either straight away or once you hit your target.
      </p>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor={ageId} className="text-[13px] font-medium text-ink-2">
            Retire at
          </label>
          <input
            id={ageId}
            type="number"
            min={40}
            max={70}
            value={coastTargetAge}
            onChange={(e) => onCoastTargetAgeChange(parseInt(e.target.value) || 50)}
            className={`${controlClass} fig`}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={spendId} className="text-[13px] font-medium text-ink-2">
            Spending a year while coasting
          </label>
          <MoneyInput id={spendId} value={coastCurrentSpend} onChange={onCoastCurrentSpendChange} step={1000} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={saveId} className="text-[13px] font-medium text-ink-2">
            Saving a month while coasting
          </label>
          <MoneyInput id={saveId} value={coastMonthlySavings} onChange={onCoastMonthlySavingsChange} step={100} />
        </div>
      </div>
      <div className="grid gap-6 border-t border-line-2 pt-3 md:grid-cols-2">
        <CoastColumn title="Coast from now" explain="Save the coasting amount from today." result={coastNow} />
        <CoastColumn
          title="Coast after your target"
          explain="Keep saving as now until you reach your target, then save the coasting amount."
          result={coastAfterMinFire}
        />
      </div>
    </Panel>
  );
}
