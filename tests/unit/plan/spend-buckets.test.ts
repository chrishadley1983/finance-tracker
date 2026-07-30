import { describe, it, expect } from 'vitest';
import { computeRunRate } from '@/lib/plan/spend';
import { bucketTotals } from '@/lib/plan/buckets';

const cat = (name: string, extra: Partial<{ is_income: boolean; exclude_from_totals: boolean }> = {}) => ({
  name,
  is_income: false,
  exclude_from_totals: false,
  ...extra,
});

describe('spending run-rate (criterion F3)', () => {
  it('sums expenses sign-aware and applies the exclusion list', () => {
    const r = computeRunRate([
      { amount: -1_000, category: cat('Groceries') },
      { amount: -500, category: cat('Home improvement') }, // excluded (kitchen)
      { amount: -200, category: cat('Lego Out') }, // excluded (business)
      { amount: -300, category: cat('Work Travel') }, // excluded (reimbursed)
      { amount: -50, category: cat('Extension') }, // excluded
      { amount: 2_000, category: cat('Salary', { is_income: true }) }, // income
      { amount: -75, category: cat('Transfers', { exclude_from_totals: true }) },
      { amount: 120, category: cat('Groceries') }, // refund: positive, skipped
      { amount: -40, category: null }, // uncategorised, skipped
    ]);
    expect(r.trailing12moSpend).toBe(1_000);
    expect(r.excludedTotal).toBe(1_050);
    expect(r.vsPlanLine).toBe(1_000 - 69_500);
  });
});

describe('pot buckets (criteria F2, F9)', () => {
  it('groups latest balances into accessible / Chris pension / Abby pension', () => {
    const b = bucketTotals([
      { date: '2026-07-01', balance: 440_000, account: { name: 'Chris II SIPP Pension', type: 'pension' } },
      { date: '2026-07-01', balance: 191_000, account: { name: 'Chris Accenture Pens', type: 'pension' } },
      { date: '2026-07-01', balance: 274_035, account: { name: 'Abby Accenture Pension', type: 'pension' } },
      { date: '2026-07-01', balance: 310_000, account: { name: 'Abby S&S ISA', type: 'isa' } },
      { date: '2026-06-01', balance: 300_000, account: { name: 'Abby S&S ISA', type: 'isa' } }, // older, ignored
      { date: '2026-07-01', balance: 25_000, account: { name: 'Other Savings', type: 'savings' } },
      { date: '2026-07-01', balance: 695_000, account: { name: 'House Net Worth', type: 'property' } }, // excluded
      { date: '2026-07-01', balance: -1_347, account: { name: 'HSBC Credit Card', type: 'credit' } }, // excluded
    ]);
    expect(b.chrisPension).toBe(631_000);
    expect(b.abbyPension).toBe(274_035);
    expect(b.accessible).toBe(335_000);
    expect(b.total).toBe(631_000 + 274_035 + 335_000);
    expect(b.isBaseline).toBe(false);
    expect(b.asOf).toBe('2026-07-01');
  });

  it('falls back to the June 2026 baseline with no snapshots (F2/E2)', () => {
    const b = bucketTotals([]);
    expect(b.isBaseline).toBe(true);
    expect(b.chrisPension).toBe(624_954);
    expect(b.abbyPension).toBe(272_948);
    expect(b.accessible).toBe(709_000);
  });

  it('routes unknown pension accounts by name; unknown other types to accessible', () => {
    const b = bucketTotals([
      { date: '2026-07-01', balance: 10_000, account: { name: 'Abby New SIPP', type: 'pension' } },
      { date: '2026-07-01', balance: 5_000, account: { name: 'New Cash ISA', type: 'isa' } },
      { date: '2026-07-01', balance: 7_000, account: { name: 'Someday Fund', type: 'tracking' } }, // excluded
    ]);
    expect(b.abbyPension).toBe(10_000);
    expect(b.accessible).toBe(5_000);
  });
});
