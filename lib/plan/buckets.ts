/**
 * Pot buckets for the Where-we-are section and portfolio split:
 * accessible / Chris pension (Nov 2040) / Abby pension (Aug 2043).
 */

import { ACCOUNT_BUCKETS, POTS_BASELINE } from './constants';

export type Bucket = 'accessible' | 'chrisPension' | 'abbyPension';

export interface SnapshotRow {
  date: string;
  balance: number;
  account: { name: string; type: string } | null;
}

export interface BucketTotals {
  accessible: number;
  chrisPension: number;
  abbyPension: number;
  total: number;
  asOf: string | null; // latest snapshot date used; null = baseline fallback
  isBaseline: boolean;
}

function bucketFor(name: string, type: string): Bucket | 'excluded' {
  const mapped = ACCOUNT_BUCKETS[name];
  if (mapped) return mapped;
  if (type === 'pension') return name.toLowerCase().includes('abby') ? 'abbyPension' : 'chrisPension';
  if (['property', 'tracking', 'credit', 'other'].includes(type)) return 'excluded';
  return 'accessible';
}

/**
 * Latest balance per account, summed into buckets. Falls back to the plan's
 * June 2026 baseline when there are no snapshots at all.
 */
export function bucketTotals(snapshots: SnapshotRow[]): BucketTotals {
  const latest = new Map<string, SnapshotRow>();
  for (const s of snapshots) {
    if (!s.account) continue;
    const prev = latest.get(s.account.name);
    if (!prev || s.date > prev.date) latest.set(s.account.name, s);
  }
  if (latest.size === 0) {
    return {
      accessible: POTS_BASELINE.nonPension,
      chrisPension: POTS_BASELINE.chrisPension,
      abbyPension: POTS_BASELINE.abbyPension,
      total: POTS_BASELINE.nonPension + POTS_BASELINE.chrisPension + POTS_BASELINE.abbyPension,
      asOf: null,
      isBaseline: true,
    };
  }
  const totals = { accessible: 0, chrisPension: 0, abbyPension: 0 };
  let asOf = '';
  for (const s of Array.from(latest.values())) {
    const b = bucketFor(s.account!.name, s.account!.type);
    if (b === 'excluded') continue;
    totals[b] += Number(s.balance);
    if (s.date > asOf) asOf = s.date;
  }
  return {
    ...totals,
    total: totals.accessible + totals.chrisPension + totals.abbyPension,
    asOf: asOf || null,
    isBaseline: false,
  };
}
