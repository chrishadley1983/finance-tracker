import { describe, it, expect } from 'vitest';
import { matchAgainstBankFeed } from '@/lib/import/dedup';

const tx = (date: string, amount: number, description = 'CSV ROW') => ({ date, amount, description });

describe('matchAgainstBankFeed (CSV import vs bank-synced rows)', () => {
  it('skips a CSV row the feed already holds under a different date (within 3 days)', () => {
    const { toInsert, matchedToFeed } = matchAgainstBankFeed([tx('2026-07-10', -42.5)], [{ date: '2026-07-12', amount: -42.5 }]);
    expect(matchedToFeed).toHaveLength(1);
    expect(toInsert).toHaveLength(0);
  });

  it('inserts when the nearest feed row is more than the tolerance away', () => {
    const { toInsert } = matchAgainstBankFeed([tx('2026-07-10', -42.5)], [{ date: '2026-07-14', amount: -42.5 }]);
    expect(toInsert).toHaveLength(1);
  });

  it('matches amounts to the penny, not approximately', () => {
    const { toInsert } = matchAgainstBankFeed([tx('2026-07-10', -42.5)], [{ date: '2026-07-10', amount: -42.51 }]);
    expect(toInsert).toHaveLength(1);
  });

  it('consumes each feed row once: two identical CSV rows vs one feed row inserts one', () => {
    const { toInsert, matchedToFeed } = matchAgainstBankFeed(
      [tx('2026-07-10', -3.2), tx('2026-07-10', -3.2)],
      [{ date: '2026-07-10', amount: -3.2 }],
    );
    expect(matchedToFeed).toHaveLength(1);
    expect(toInsert).toHaveLength(1);
  });

  it('pairs each CSV row with the nearest feed date', () => {
    const { matchedToFeed, toInsert } = matchAgainstBankFeed(
      [tx('2026-07-01', -10), tx('2026-07-05', -10)],
      [{ date: '2026-07-04', amount: -10 }, { date: '2026-07-02', amount: -10 }],
    );
    expect(matchedToFeed).toHaveLength(2);
    expect(toInsert).toHaveLength(0);
  });

  it('does nothing with no feed rows', () => {
    const rows = [tx('2026-07-10', -1), tx('2026-07-11', 2)];
    expect(matchAgainstBankFeed(rows, []).toInsert).toEqual(rows);
  });
});
