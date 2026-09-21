/**
 * Pot buckets for the Where-we-are section and portfolio split:
 * accessible / Chris pension (Nov 2040) / Abby pension (Aug 2043).
 * The arithmetic lives in plan/engine/spend.mjs.
 */
import { ASSUMPTIONS } from './assumptions';
import { bucketTotals as engineBucketTotals } from '../../plan/engine/spend.mjs';

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

export const bucketTotals = (snapshots: SnapshotRow[]): BucketTotals => engineBucketTotals(ASSUMPTIONS, snapshots) as BucketTotals;
