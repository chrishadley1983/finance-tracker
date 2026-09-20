'use client';

import { useMemo } from 'react';
import { buildLadder } from '@/lib/plan/ladder';
import { PALETTE, POTS, type GiltPrice } from '@/lib/plan/constants';
import type { BucketTotals } from '@/lib/plan/buckets';
import { gbp, gbpK } from './format';

export interface RungRecord {
  year: number;
  status: 'pending' | 'bought' | 'split';
  epic?: string | null;
  face_value?: number | null;
  cost?: number | null;
  purchased_on?: string | null;
}

interface Props {
  prices: GiltPrice[];
  pricesStale: boolean;
  pricesAsOf: string | null;
  rungs: RungRecord[];
  buckets: BucketTotals | null;
  onToggleRung: (year: number, next: RungRecord) => void;
}

export function LadderSection({ prices, pricesStale, pricesAsOf, rungs, buckets, onToggleRung }: Props) {
  const plan = useMemo(() => buildLadder(prices), [prices]);
  const rungByYear = useMemo(() => new Map(rungs.map((r) => [r.year, r])), [rungs]);

  const boughtCost = rungs.filter((r) => r.status === 'bought').reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const years = Array.from({ length: 11 }, (_, i) => 2035 + i);
  const pendingCost = years
    .filter((y) => rungByYear.get(y)?.status !== 'bought')
    .reduce((s, y) => s + plan.allocations.filter((a) => a.targetYear === y).reduce((t, a) => t + a.estCost, 0), 0);

  // Portfolio split: ladder (bought) carved out of the buckets it lives in.
  const split = buckets
    ? [
        { label: 'Gilt ladder (bought)', value: boughtCost, color: PALETTE.navy },
        { label: 'Equities & other', value: Math.max(0, buckets.total - boughtCost - POTS.cashBuffer), color: PALETTE.blue },
        { label: 'Cash buffer', value: POTS.cashBuffer, color: PALETTE.grey },
      ]
    : [];
  const splitTotal = split.reduce((s, p) => s + p.value, 0);

  return (
    <section aria-labelledby="the-ladder">
      <h2 id="the-ladder" className="text-xl font-semibold text-slate-800 mb-1">
        The ladder
      </h2>
      <p className="text-sm text-slate-500 mb-1">
        Eleven index-linked gilt rungs, £60k (today&apos;s money) maturing each year 2035–2045. Order the{' '}
        <em>face</em> amount on II; the cost column is at the dirty price.
      </p>
      <p className={`text-xs mb-3 ${pricesStale ? 'text-amber-700' : 'text-slate-400'}`}>
        Prices {pricesStale ? 'STALE — ' : ''}as of {pricesAsOf ? new Date(pricesAsOf).toLocaleString('en-GB') : '—'}{' '}
        (dividenddata.co.uk, ~15-min delayed)
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums" data-testid="ladder-table">
          <thead>
            <tr className="bg-slate-100 text-left text-xs text-slate-600">
              <th className="px-2 py-1.5">Year</th>
              <th className="px-2 py-1.5">EPIC</th>
              <th className="px-2 py-1.5">Maturity</th>
              <th className="px-2 py-1.5 text-right">Dirty £</th>
              <th className="px-2 py-1.5 text-right">Real yld</th>
              <th className="px-2 py-1.5 text-right">Face to order</th>
              <th className="px-2 py-1.5 text-right">Est cost</th>
              <th className="px-2 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const allocs = plan.allocations.filter((a) => a.targetYear === year);
              const rec = rungByYear.get(year);
              const bought = rec?.status === 'bought';
              return allocs.map((a, i) => (
                <tr key={`${year}-${a.epic}`} className={`border-b border-slate-100 ${bought ? 'opacity-60' : ''}`}>
                  <td className="px-2 py-1">{i === 0 ? year : ''}</td>
                  <td className="px-2 py-1 font-mono">{a.epic}</td>
                  <td className="px-2 py-1">{a.maturity}</td>
                  <td className="px-2 py-1 text-right">{a.dirty.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">{a.realYield.toFixed(2)}%</td>
                  <td className="px-2 py-1 text-right">{gbp(a.face)}</td>
                  <td className="px-2 py-1 text-right">{gbp(a.estCost)}</td>
                  <td className="px-2 py-1">
                    {i === 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onToggleRung(year, {
                            year,
                            status: bought ? 'pending' : 'bought',
                            epic: allocs.map((x) => x.epic).join('+'),
                            face_value: allocs.reduce((s, x) => s + x.face, 0),
                            cost: allocs.reduce((s, x) => s + x.estCost, 0),
                            purchased_on: bought ? null : new Date().toISOString().slice(0, 10),
                          })
                        }
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          bought ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        aria-label={`Mark ${year} ${bought ? 'pending' : 'bought'}`}
                      >
                        {bought ? `bought ${rec?.purchased_on ?? ''}` : 'mark bought'}
                      </button>
                    )}
                    {a.note && <span className="ml-1 text-xs text-slate-400">{a.note}</span>}
                  </td>
                </tr>
              ));
            })}
            <tr className="font-semibold">
              <td className="px-2 py-1.5" colSpan={5}>
                Cost to complete (pending rungs at current prices)
              </td>
              <td />
              <td className="px-2 py-1.5 text-right" data-testid="cost-to-complete">
                {gbp(pendingCost)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {split.length > 0 && splitTotal > 0 && (
        <div className="mt-4">
          <div className="text-sm text-slate-600 mb-1">Portfolio split (total {gbpK(splitTotal)})</div>
          <div className="flex h-6 w-full overflow-hidden rounded" data-testid="portfolio-split">
            {split.map((p) => (
              <div
                key={p.label}
                style={{ width: `${(p.value / splitTotal) * 100}%`, backgroundColor: p.color }}
                title={`${p.label}: ${gbpK(p.value)}`}
              />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
            {split.map((p) => (
              <span key={p.label}>
                <span className="inline-block h-2 w-2 rounded-sm mr-1" style={{ backgroundColor: p.color }} />
                {p.label}: {gbpK(p.value)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
