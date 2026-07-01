/**
 * Reconcile Enable Banking transactions against the existing ledger.
 *
 * Design goals (in priority order):
 *   1. NEVER modify existing rows. We only ever INSERT genuinely-missing
 *      transactions. This guarantees user edits — renamed descriptions,
 *      hand-picked categories, is_validated flags — are always preserved.
 *   2. No duplicates. A transaction already in the DB (whether previously
 *      CSV-imported or EB-synced) must not be inserted again.
 *   3. Rename-safe re-sync. Once a row carries an EB entry_reference, future
 *      syncs match on that stable reference regardless of the live description.
 *
 * Two matching passes:
 *   Pass 1 — reference match: incoming rows whose entry_reference already
 *            exists on a DB row are skipped (that exact transaction is present).
 *   Pass 2 — cross-source match: remaining incoming rows are matched against
 *            remaining DB rows by AMOUNT + DATE-WINDOW. Descriptions are NOT
 *            compared because the bank's API wording differs from the HSBC CSV
 *            wording for the same transaction, so a description match would
 *            spuriously fail and duplicate. A small date tolerance absorbs
 *            booking-vs-value-date skew between the two sources.
 *
 * We import BOOKED transactions only; pending (PDNG) entries are volatile and
 * would churn the ledger.
 */
import type { EnableBankingTransaction } from './types';

export interface MappedEbTransaction {
  date: string; // YYYY-MM-DD
  amount: number; // signed: negative = money out
  description: string;
  entryReference?: string;
  status: string; // BOOK | PDNG
}

export interface ExistingDbRow {
  id: string;
  date: string;
  amount: number;
  /** EB entry_reference stored on prior syncs (hsbc_transaction_id); null for CSV rows. */
  ref: string | null;
}

export interface ReconcileOptions {
  /** Days of tolerance when matching EB dates to existing dates (default 3). */
  dateToleranceDays?: number;
  /** Include pending (PDNG) transactions (default false). */
  includePending?: boolean;
}

export interface ReconcilePlan {
  toInsert: MappedEbTransaction[];
  refMatched: MappedEbTransaction[];
  countMatched: MappedEbTransaction[];
  pendingSkipped: number;
  summary: {
    incoming: number;
    booked: number;
    toInsert: number;
    alreadyPresent: number;
  };
}

/** Best-available posting date for an EB transaction. */
export function ebTransactionDate(tx: EnableBankingTransaction): string | undefined {
  return tx.booking_date ?? tx.value_date ?? tx.transaction_date;
}

/** Human-readable description from the various EB fields, matching CSV feel. */
export function ebTransactionDescription(tx: EnableBankingTransaction): string {
  const remittance = tx.remittance_information?.filter(Boolean).join(' ').trim();
  return (
    (remittance && remittance.length > 0 ? remittance : undefined) ??
    tx.remittance_information_structured?.trim() ??
    tx.creditor?.name?.trim() ??
    tx.debtor?.name?.trim() ??
    tx.bank_transaction_code?.description?.trim() ??
    'Unknown transaction'
  );
}

/** Map an EB transaction to our signed-amount ledger shape. Returns null if unusable. */
export function mapEbTransaction(tx: EnableBankingTransaction): MappedEbTransaction | null {
  const date = ebTransactionDate(tx);
  const raw = Number(tx.transaction_amount?.amount);
  if (!date || !Number.isFinite(raw)) return null;
  const magnitude = Math.abs(raw);
  const amount = tx.credit_debit_indicator === 'DBIT' ? -magnitude : magnitude;
  return {
    date,
    amount,
    description: ebTransactionDescription(tx),
    entryReference: tx.entry_reference || undefined,
    status: tx.status,
  };
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.abs(ms) / 86_400_000;
}

/**
 * Compute which incoming EB transactions need inserting. Pure function — no I/O.
 */
export function planReconcile(
  incoming: MappedEbTransaction[],
  existing: ExistingDbRow[],
  opts: ReconcileOptions = {},
): ReconcilePlan {
  const tolerance = opts.dateToleranceDays ?? 3;
  const includePending = opts.includePending ?? false;

  const booked = includePending ? incoming : incoming.filter((t) => t.status === 'BOOK');
  const pendingSkipped = incoming.length - booked.length;

  const consumed = new Set<string>();

  // Pass 1: reference match.
  const existingByRef = new Map<string, ExistingDbRow>();
  for (const r of existing) {
    if (r.ref) existingByRef.set(r.ref, r);
  }
  const refMatched: MappedEbTransaction[] = [];
  const afterRef: MappedEbTransaction[] = [];
  for (const t of booked) {
    const match = t.entryReference ? existingByRef.get(t.entryReference) : undefined;
    if (match && !consumed.has(match.id)) {
      consumed.add(match.id);
      refMatched.push(t);
    } else {
      afterRef.push(t);
    }
  }

  // Pass 2: cross-source greedy match on amount, nearest date within tolerance.
  const byAmount = new Map<string, ExistingDbRow[]>();
  for (const r of existing) {
    if (consumed.has(r.id)) continue;
    const key = r.amount.toFixed(2);
    let bucket = byAmount.get(key);
    if (!bucket) {
      bucket = [];
      byAmount.set(key, bucket);
    }
    bucket.push(r);
  }

  const toInsert: MappedEbTransaction[] = [];
  const countMatched: MappedEbTransaction[] = [];
  for (const t of afterRef) {
    const candidates = byAmount.get(t.amount.toFixed(2)) ?? [];
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (consumed.has(c.id)) continue;
      const diff = daysBetween(t.date, c.date);
      if (diff <= tolerance && diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      consumed.add(candidates[bestIdx].id);
      countMatched.push(t);
    } else {
      toInsert.push(t);
    }
  }

  return {
    toInsert,
    refMatched,
    countMatched,
    pendingSkipped,
    summary: {
      incoming: incoming.length,
      booked: booked.length,
      toInsert: toInsert.length,
      alreadyPresent: refMatched.length + countMatched.length,
    },
  };
}
