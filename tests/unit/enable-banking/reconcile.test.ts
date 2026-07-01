import { describe, it, expect } from 'vitest';
import {
  mapEbTransaction,
  planReconcile,
  ebTransactionDate,
  ebTransactionDescription,
  type MappedEbTransaction,
  type ExistingDbRow,
} from '@/lib/enable-banking/reconcile';
import type { EnableBankingTransaction } from '@/lib/enable-banking/types';

function eb(partial: Partial<EnableBankingTransaction>): EnableBankingTransaction {
  return {
    transaction_amount: { amount: '10.00', currency: 'GBP' },
    credit_debit_indicator: 'DBIT',
    status: 'BOOK',
    booking_date: '2026-01-10',
    ...partial,
  };
}

function mapped(partial: Partial<MappedEbTransaction>): MappedEbTransaction {
  return {
    date: '2026-01-10',
    amount: -10,
    description: 'Test',
    status: 'BOOK',
    ...partial,
  };
}

function existing(partial: Partial<ExistingDbRow>): ExistingDbRow {
  return { id: crypto.randomUUID(), date: '2026-01-10', amount: -10, ref: null, ...partial };
}

describe('mapEbTransaction', () => {
  it('signs DBIT negative and CRDT positive', () => {
    expect(mapEbTransaction(eb({ credit_debit_indicator: 'DBIT' }))?.amount).toBe(-10);
    expect(mapEbTransaction(eb({ credit_debit_indicator: 'CRDT' }))?.amount).toBe(10);
  });

  it('always signs by indicator even if amount already negative', () => {
    const m = mapEbTransaction(eb({ transaction_amount: { amount: '-10.00', currency: 'GBP' }, credit_debit_indicator: 'DBIT' }));
    expect(m?.amount).toBe(-10);
  });

  it('falls back date booking → value → transaction', () => {
    expect(ebTransactionDate(eb({ booking_date: undefined, value_date: '2026-02-01' }))).toBe('2026-02-01');
    expect(ebTransactionDate(eb({ booking_date: undefined, value_date: undefined, transaction_date: '2026-03-01' }))).toBe('2026-03-01');
  });

  it('builds description from remittance, then creditor/debtor', () => {
    expect(ebTransactionDescription(eb({ remittance_information: ['TESCO', 'STORES'] }))).toBe('TESCO STORES');
    expect(ebTransactionDescription(eb({ remittance_information: [], creditor: { name: 'ACME' } }))).toBe('ACME');
    expect(ebTransactionDescription(eb({ remittance_information: undefined, debtor: { name: 'BOB' } }))).toBe('BOB');
  });

  it('returns null when unusable (no date or amount)', () => {
    expect(mapEbTransaction(eb({ booking_date: undefined, value_date: undefined, transaction_date: undefined }))).toBeNull();
    expect(mapEbTransaction(eb({ transaction_amount: { amount: 'not-a-number', currency: 'GBP' } }))).toBeNull();
  });
});

describe('planReconcile', () => {
  it('inserts everything when the ledger is empty', () => {
    const plan = planReconcile([mapped({ amount: -5 }), mapped({ amount: -6 })], []);
    expect(plan.toInsert).toHaveLength(2);
    expect(plan.summary.alreadyPresent).toBe(0);
  });

  it('skips pending (PDNG) transactions by default', () => {
    const plan = planReconcile([mapped({ status: 'PDNG' }), mapped({ status: 'BOOK' })], []);
    expect(plan.pendingSkipped).toBe(1);
    expect(plan.toInsert).toHaveLength(1);
  });

  it('includes pending when asked', () => {
    const plan = planReconcile([mapped({ status: 'PDNG' })], [], { includePending: true });
    expect(plan.pendingSkipped).toBe(0);
    expect(plan.toInsert).toHaveLength(1);
  });

  it('Pass 1: skips rows whose entry_reference already exists (rename-safe)', () => {
    const plan = planReconcile(
      [mapped({ entryReference: 'ref-1', amount: -10 })],
      [existing({ ref: 'ref-1', amount: -10, date: '2026-01-10' })],
    );
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.refMatched).toHaveLength(1);
  });

  it('Pass 2: skips exact date+amount match against CSV rows (no ref)', () => {
    const plan = planReconcile(
      [mapped({ amount: -12.34, date: '2026-01-10' })],
      [existing({ amount: -12.34, date: '2026-01-10', ref: null })],
    );
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.countMatched).toHaveLength(1);
  });

  it('cross-source match ignores description differences entirely', () => {
    // ExistingDbRow carries no description — matching is amount+date only, so a
    // user-renamed row still matches its EB counterpart.
    const plan = planReconcile(
      [mapped({ amount: -50, date: '2026-01-10', description: 'AMAZON UK*NB3T LONDON' })],
      [existing({ amount: -50, date: '2026-01-10', ref: null })],
    );
    expect(plan.toInsert).toHaveLength(0);
  });

  it('absorbs booking/value date skew within tolerance', () => {
    const plan = planReconcile(
      [mapped({ amount: -20, date: '2026-01-12' })],
      [existing({ amount: -20, date: '2026-01-10', ref: null })],
      { dateToleranceDays: 3 },
    );
    expect(plan.toInsert).toHaveLength(0);
  });

  it('inserts when date differs beyond tolerance', () => {
    const plan = planReconcile(
      [mapped({ amount: -20, date: '2026-01-20' })],
      [existing({ amount: -20, date: '2026-01-10', ref: null })],
      { dateToleranceDays: 3 },
    );
    expect(plan.toInsert).toHaveLength(1);
  });

  it('count-based: DB has 1 of a repeated amount, EB has 2 → insert 1', () => {
    const plan = planReconcile(
      [mapped({ amount: -8.8, date: '2026-01-10' }), mapped({ amount: -8.8, date: '2026-01-10' })],
      [existing({ amount: -8.8, date: '2026-01-10', ref: null })],
      { dateToleranceDays: 0 },
    );
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.countMatched).toHaveLength(1);
  });

  it('count-based: DB has 2, EB has 2 → insert 0', () => {
    const plan = planReconcile(
      [mapped({ amount: -8.8 }), mapped({ amount: -8.8 })],
      [existing({ amount: -8.8, ref: null }), existing({ amount: -8.8, ref: null })],
      { dateToleranceDays: 0 },
    );
    expect(plan.toInsert).toHaveLength(0);
  });

  it('is idempotent once inserted rows carry their EB reference', () => {
    const incoming = [mapped({ entryReference: 'r1', amount: -10 }), mapped({ entryReference: 'r2', amount: -11 })];
    // First run: empty ledger.
    const first = planReconcile(incoming, []);
    expect(first.toInsert).toHaveLength(2);
    // Simulate DB now holding those rows with their refs, then re-sync.
    const nowExisting: ExistingDbRow[] = first.toInsert.map((t) => existing({ amount: t.amount, ref: t.entryReference! }));
    const second = planReconcile(incoming, nowExisting);
    expect(second.toInsert).toHaveLength(0);
    expect(second.refMatched).toHaveLength(2);
  });

  it('does not double-consume: two EB rows, one existing → one matches, one inserts', () => {
    const plan = planReconcile(
      [mapped({ amount: -15, date: '2026-01-10' }), mapped({ amount: -15, date: '2026-01-10' })],
      [existing({ amount: -15, date: '2026-01-10', ref: null })],
      { dateToleranceDays: 2 },
    );
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.summary.alreadyPresent).toBe(1);
  });

  it('ref match consumes the row so it is not reused for count matching', () => {
    // EB: one ref'd row + one plain row, both -10 same day. Existing: the ref'd
    // row only. The ref match consumes it; the plain row must insert.
    const plan = planReconcile(
      [mapped({ entryReference: 'r1', amount: -10, date: '2026-01-10' }), mapped({ amount: -10, date: '2026-01-10' })],
      [existing({ amount: -10, date: '2026-01-10', ref: 'r1' })],
      { dateToleranceDays: 2 },
    );
    expect(plan.refMatched).toHaveLength(1);
    expect(plan.toInsert).toHaveLength(1);
  });
});
