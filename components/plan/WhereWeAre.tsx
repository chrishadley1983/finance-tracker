'use client';

import type { BucketTotals } from '@/lib/plan/buckets';
import type { RunRate } from '@/lib/plan/spend';
import { SPEND } from '@/lib/plan/constants';
import { gbp, gbpK } from './format';

interface Props {
  buckets: BucketTotals | null;
  runRate: RunRate | null;
  dataWarning?: string | null;
}

const CARDS: Array<{ key: 'accessible' | 'chrisPension' | 'abbyPension'; label: string; sub: string }> = [
  { key: 'accessible', label: 'Accessible now', sub: 'ISAs · cash · crypto' },
  { key: 'chrisPension', label: 'Chris pension', sub: 'unlocks Nov 2040' },
  { key: 'abbyPension', label: 'Abby pension', sub: 'unlocks Aug 2043' },
];

export function WhereWeAre({ buckets, runRate, dataWarning }: Props) {
  return (
    <section aria-labelledby="where-we-are">
      <h2 id="where-we-are" className="text-xl font-semibold text-slate-800 mb-1">
        Where we are
      </h2>
      {dataWarning && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3">{dataWarning}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {CARDS.map((c) => (
          <div key={c.key} className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="text-2xl font-semibold text-slate-900 tabular-nums">
              {buckets ? gbpK(buckets[c.key]) : '—'}
            </div>
            <div className="text-xs text-slate-400">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-slate-500">Total investable: </span>
          <span className="font-semibold tabular-nums">{buckets ? gbpK(buckets.total) : '—'}</span>
          {buckets?.isBaseline && (
            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">June 2026 baseline</span>
          )}
          {buckets?.asOf && <span className="ml-2 text-xs text-slate-400">snapshots as of {buckets.asOf}</span>}
        </div>
        <div>
          <span className="text-slate-500">Spending, trailing 12 months: </span>
          {runRate ? (
            <>
              <span className="font-semibold tabular-nums">{gbp(runRate.trailing12moSpend)}</span>
              <span className={`ml-2 text-xs ${runRate.vsPlanLine > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {runRate.vsPlanLine > 0 ? '+' : ''}
                {gbp(runRate.vsPlanLine)} vs the {gbp(SPEND.planLine)} plan line
              </span>
              <span className="ml-2 text-xs text-slate-400">
                (excludes kitchen/business/work travel: {gbp(runRate.excludedTotal)})
              </span>
            </>
          ) : (
            <span className="text-slate-400">unavailable</span>
          )}
        </div>
      </div>
    </section>
  );
}
