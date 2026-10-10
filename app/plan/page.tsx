'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout';
import { WhereWeAre } from '@/components/plan/WhereWeAre';
import { PivotSection } from '@/components/plan/PivotSection';
import { LadderSection, type RungRecord } from '@/components/plan/LadderSection';
import { OutlookSection } from '@/components/plan/OutlookSection';
import { bucketTotals, type BucketTotals } from '@/lib/plan/buckets';
import type { RunRate } from '@/lib/plan/spend';
import { FALLBACK_GILT_PRICES, LATEST_ACCEPTED, ASSUMPTIONS_PREPARED_ON, type GiltPrice } from '@/lib/plan/assumptions';

export default function PlanPage() {
  const [buckets, setBuckets] = useState<BucketTotals | null>(null);
  const [runRate, setRunRate] = useState<RunRate | null>(null);
  const [dataWarning, setDataWarning] = useState<string | null>(null);
  const [prices, setPrices] = useState<GiltPrice[]>(FALLBACK_GILT_PRICES);
  const [pricesStale, setPricesStale] = useState(true);
  const [pricesAsOf, setPricesAsOf] = useState<string | null>(null);
  const [rungs, setRungs] = useState<RungRecord[]>([]);

  const load = useCallback(async () => {
    const warnings: string[] = [];
    try {
      const res = await fetch('/api/wealth-snapshots');
      if (!res.ok) throw new Error(`snapshots HTTP ${res.status}`);
      const { snapshots } = await res.json();
      setBuckets(bucketTotals(snapshots ?? []));
    } catch {
      warnings.push('Live snapshots unavailable — showing the pots recorded in plan/assumptions.json.');
      setBuckets(bucketTotals([]));
    }
    try {
      const res = await fetch('/api/plan/run-rate');
      const body = await res.json();
      if (body.runRate) setRunRate(body.runRate);
      else warnings.push('Spending run-rate unavailable.');
    } catch {
      warnings.push('Spending run-rate unavailable.');
    }
    try {
      const res = await fetch('/api/plan/gilt-prices');
      const body = await res.json();
      if (body.gilts?.length) {
        setPrices(body.gilts);
        setPricesStale(Boolean(body.stale));
        setPricesAsOf(body.asOf ?? null);
      }
    } catch {
      // keep fallback prices; the section shows its own stale banner
    }
    try {
      const res = await fetch('/api/plan/rungs');
      const body = await res.json();
      setRungs(body.rungs ?? []);
      if (body.warning) warnings.push('Rung tracking table missing — run migration 009 to persist purchases.');
    } catch {
      warnings.push('Rung tracking unavailable.');
    }
    setDataWarning(warnings.length ? warnings.join(' ') : null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleRung = useCallback(async (year: number, next: RungRecord) => {
    setRungs((prev) => {
      const rest = prev.filter((r) => r.year !== year);
      return [...rest, next].sort((a, b) => a.year - b.year);
    });
    try {
      await fetch('/api/plan/rungs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch {
      // optimistic update stands; next load reconciles
    }
  }, []);

  return (
    <AppLayout title="Plan">
      <div className="mx-auto max-w-5xl space-y-10 pb-16">
        <div className="space-y-2">
          <p className="text-sm text-slate-500" title="Numbers come from plan/assumptions.json; documents from plan/runs/<date>/ — see plan/README.md">
            The household plan, live: pots, the pension pivot, the gilt ladder and the outlook. Every number here is read from
            plan/assumptions.json (prepared {ASSUMPTIONS_PREPARED_ON}).
          </p>
          {LATEST_ACCEPTED.runId ? (
            <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Accepted plan: run <b>{LATEST_ACCEPTED.runId}</b>
              {LATEST_ACCEPTED.acceptedOn ? ` (accepted ${LATEST_ACCEPTED.acceptedOn.slice(0, 10)})` : ''}
              {LATEST_ACCEPTED.headline?.atRetirement ? ` — £${(LATEST_ACCEPTED.headline.atRetirement / 1000).toFixed(2)}M at retirement, £${((LATEST_ACCEPTED.headline.atEnd ?? 0) / 1000).toFixed(2)}M at the end (planning case)` : ''}
              {LATEST_ACCEPTED.avcPct != null ? `; AVC ${LATEST_ACCEPTED.avcPct}%` : ''}
              {LATEST_ACCEPTED.note ? ` — ${LATEST_ACCEPTED.note}` : ''}. Live figures below may differ; the run folder is the record.
            </p>
          ) : (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No accepted plan run yet. Run <code>npm run plan:run</code>, review <code>plan/runs/&lt;date&gt;/diff.md</code>, then <code>npm run plan:accept -- &lt;date&gt;</code>.
            </p>
          )}
        </div>
        <WhereWeAre buckets={buckets} runRate={runRate} dataWarning={dataWarning} />
        <PivotSection />
        <LadderSection
          prices={prices}
          pricesStale={pricesStale}
          pricesAsOf={pricesAsOf}
          rungs={rungs}
          buckets={buckets}
          onToggleRung={handleToggleRung}
        />
        <OutlookSection />
      </div>
    </AppLayout>
  );
}
