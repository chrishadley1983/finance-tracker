import { describe, it, expect } from 'vitest';
import { SPEND, POTS_BASELINE } from '@/lib/plan/assumptions';
import { computeRunRate } from '@/lib/plan/spend';
import { bucketTotals } from '@/lib/plan/buckets';

const cat = (name: string, extra: Partial<{ is_income: boolean; exclude_from_totals: boolean }> = {}) => ({
  name,
  is_income: false,
  exclude_from_totals: false,
  ...extra,
});

describe('spending run-rate (criterion F3)', () => {
  it('sums expenses net of credits and applies the exclusion list', () => {
    const r = computeRunRate([
      { amount: -1_000, category: cat('Groceries') },
      { amount: -500, category: cat('Home improvement') }, // excluded (kitchen)
      { amount: -200, category: cat('Lego Out') }, // excluded (business)
      { amount: -300, category: cat('Work Travel') }, // excluded (reimbursed)
      { amount: -50, category: cat('Extension') }, // excluded
      { amount: 2_000, category: cat('Salary', { is_income: true }) }, // income
      { amount: -75, category: cat('Transfers', { exclude_from_totals: true }) },
      { amount: 120, category: cat('Groceries') }, // refund / someone paying us back: NETS against the category (21 Sep 2026)
      { amount: 30, category: cat('Work Travel') }, // reimbursement in an excluded category: nets the excluded total
      { amount: -40, category: null }, // uncategorised, skipped
    ]);
    expect(r.grossSpend).toBe(1_000);
    expect(r.creditsNetted).toBe(120);
    expect(r.trailing12moSpend).toBe(880);
    expect(r.excludedTotal).toBe(1_050 - 30);
    expect(r.vsPlanLine).toBe(880 - SPEND.planLine); // plan line comes from plan/assumptions.json
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

  it('falls back to the assumptions-file baseline (1 Sep 2026 pots) with no snapshots (F2/E2)', () => {
    const b = bucketTotals([]);
    expect(b.isBaseline).toBe(true);
    // DERIVED in plan/assumptions.json from the per-account snapshot values
    expect(b.chrisPension).toBe(POTS_BASELINE.chrisPension);
    expect(b.chrisPension).toBe(439_574 + 193_081);
    expect(b.abbyPension).toBe(POTS_BASELINE.abbyPension);
    expect(b.accessible).toBe(POTS_BASELINE.nonPension);
    expect(b.accessible).toBe(276_716 + 312_573 + 119_924 + 1_960);
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
