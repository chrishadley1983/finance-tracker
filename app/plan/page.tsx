'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout';
import { WhereWeAre } from '@/components/plan/WhereWeAre';
import { PivotSection } from '@/components/plan/PivotSection';
import { LadderSection, type RungRecord } from '@/components/plan/LadderSection';
import { OutlookSection } from '@/components/plan/OutlookSection';
import { bucketTotals, type BucketTotals } from '@/lib/plan/buckets';
import type { RunRate } from '@/lib/plan/spend';
import { FALLBACK_GILT_PRICES, type GiltPrice } from '@/lib/plan/constants';

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
      warnings.push('Live snapshots unavailable — showing the June 2026 baseline.');
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
        <div>
          <p className="text-sm text-slate-500" title="Full write-up: plan/runs/2026-07-30-amendment-1/investment-plan-amendment-1-2026-07.pdf (frozen; see plan/decisions.md for what has moved since)">
            The July 2026 plan, live: pots, the pension pivot, the gilt ladder and the outlook.
          </p>
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
