import { describe, it, expect } from 'vitest';
import { planImport, normalizeDescription, tupleKey } from '@/lib/import/dedup';

// Shorthand row factory
const tx = (
  rowNumber: number,
  date: string,
  amount: number,
  description: string,
) => ({ rowNumber, date, amount, description });

describe('normalizeDescription', () => {
  it('strips trailing ))) contactless suffix', () => {
    expect(normalizeDescription('WAITROSE STORES TONBRIDGE )))')).toBe('waitrose stores tonbridge');
  });

  it('strips trailing payment-method suffixes', () => {
    expect(normalizeDescription('trainline +443332022222 VIS')).toBe('trainline +443332022222');
    expect(normalizeDescription('SKY DIGITAL DD')).toBe('sky digital');
    expect(normalizeDescription('Hadley Bricks CR')).toBe('hadley bricks');
  });

  it('collapses multiple internal spaces', () => {
    // Real pattern from HSBC: "1.3248  Visa" vs "1.3248 Visa"
    expect(normalizeDescription('INTL 0043 SUPABASE USD 25.00 @ 1.3248  Visa Rate VIS'))
      .toBe('intl 0043 supabase usd 25.00 @ 1.3248 visa rate');
  });
});

describe('planImport — count-based dedup', () => {
  it('inserts every row when DB is empty', () => {
    const incoming = [
      tx(1, '2026-04-01', -10, 'A'),
      tx(2, '2026-04-01', -20, 'B'),
    ];
    const { toInsert, toSkip } = planImport(incoming, []);
    expect(toInsert).toHaveLength(2);
    expect(toSkip).toHaveLength(0);
  });

  it('skips every row when DB already has the exact same rows', () => {
    const incoming = [
      tx(1, '2026-04-01', -10, 'A'),
      tx(2, '2026-04-01', -20, 'B'),
    ];
    const existing = [
      { date: '2026-04-01', amount: -10, description: 'A' },
      { date: '2026-04-01', amount: -20, description: 'B' },
    ];
    const { toInsert, toSkip } = planImport(incoming, existing);
    expect(toInsert).toHaveLength(0);
    expect(toSkip).toHaveLength(2);
  });

  // The bug that caused the missing TFL: two legitimate identical rows
  // in the CSV were collapsed to one insert by same-batch hash dedup.
  it('inserts BOTH of two identical rows in the same CSV when DB is empty', () => {
    const incoming = [
      tx(1, '2026-04-07', -8.80, 'TFL TRAVEL CH TFL.GOV.UK/CP )))'),
      tx(2, '2026-04-07', -8.80, 'TFL TRAVEL CH TFL.GOV.UK/CP )))'),
    ];
    const { toInsert, toSkip } = planImport(incoming, []);
    expect(toInsert).toHaveLength(2);
    expect(toSkip).toHaveLength(0);
  });

  // Partial prior import: CSV has 3 identical rows, DB already has 1.
  // Insert only the 2 that are missing.
  it('inserts only the surplus when DB partially covers a repeated tuple', () => {
    const incoming = [
      tx(1, '2026-04-07', -8.80, 'TFL'),
      tx(2, '2026-04-07', -8.80, 'TFL'),
      tx(3, '2026-04-07', -8.80, 'TFL'),
    ];
    const existing = [{ date: '2026-04-07', amount: -8.80, description: 'TFL' }];
    const { toInsert, toSkip } = planImport(incoming, existing);
    expect(toInsert).toHaveLength(2);
    expect(toSkip).toHaveLength(1);
  });

  // The bug that caused the 33 duplicates: re-importing the same CSV
  // after hash gaps. Count-based dedup ignores the hash table entirely
  // and just compares row counts in DB, so re-imports are idempotent.
  it('is idempotent across multiple re-imports of the same CSV', () => {
    const csv = [
      tx(1, '2026-03-26', -1300, 'HSBC PREMIER543458 543458******8906 BP'),
      tx(2, '2026-03-26', -547.68, 'AIRBNB * HMBEKDPAHS LONDON GBR'),
      tx(3, '2026-03-26', -100, 'STOCKS GREEN PRIMA TONBRIDGE VIS'),
    ];

    // First import: DB empty → all 3 insert
    const first = planImport(csv, []);
    expect(first.toInsert).toHaveLength(3);

    // Simulate DB after first import
    const afterFirst = first.toInsert.map((t) => ({
      date: t.date, amount: t.amount, description: t.description,
    }));

    // Second import of same CSV: nothing should insert
    const second = planImport(csv, afterFirst);
    expect(second.toInsert).toHaveLength(0);
    expect(second.toSkip).toHaveLength(3);
  });

  it('treats CSV and DB description-suffix variants as the same tuple', () => {
    // HSBC exports the same transaction with or without the ))) suffix.
    // Dedup should see them as one tuple.
    const incoming = [tx(1, '2026-04-21', -11.48, 'WAITROSE STORES TONBRIDGE')];
    const existing = [{ date: '2026-04-21', amount: -11.48, description: 'WAITROSE STORES TONBRIDGE )))' }];
    const { toInsert } = planImport(incoming, existing);
    expect(toInsert).toHaveLength(0);
  });

  it('inserts rows when amounts differ even at same date and description', () => {
    const incoming = [
      tx(1, '2026-04-01', -10, 'Coffee'),
      tx(2, '2026-04-01', -5, 'Coffee'),
    ];
    const existing = [{ date: '2026-04-01', amount: -10, description: 'Coffee' }];
    const { toInsert, toSkip } = planImport(incoming, existing);
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0].amount).toBe(-5);
    expect(toSkip).toHaveLength(1);
    expect(toSkip[0].amount).toBe(-10);
  });

  it('skips the earliest N CSV occurrences when DB already has N of the tuple', () => {
    // CSV has 3 identical rows, DB has 1. Treat the first CSV occurrence as
    // already-covered; insert rows 2 and 3. This keeps net count correct;
    // which specific rows insert vs skip is arbitrary since the tuples are
    // identical by definition.
    const incoming = [
      tx(1, '2026-04-07', -8.80, 'TFL'),
      tx(2, '2026-04-07', -8.80, 'TFL'),
      tx(3, '2026-04-07', -8.80, 'TFL'),
    ];
    const existing = [{ date: '2026-04-07', amount: -8.80, description: 'TFL' }];
    const { toInsert, toSkip } = planImport(incoming, existing);
    expect(toInsert.map((t) => t.rowNumber)).toEqual([2, 3]);
    expect(toSkip.map((t) => t.rowNumber)).toEqual([1]);
  });
});

describe('tupleKey', () => {
  it('produces a stable key from date, amount, normalised description', () => {
    expect(tupleKey('2026-04-01', -10, 'A DD')).toBe(tupleKey('2026-04-01', -10, 'A'));
  });

  it('differentiates keys on amount sign', () => {
    expect(tupleKey('2026-04-01', 10, 'A')).not.toBe(tupleKey('2026-04-01', -10, 'A'));
  });
});
