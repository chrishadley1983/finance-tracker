import { describe, it, expect } from 'vitest';
import { buildLadder, sizeByBudget } from '@/lib/plan/ladder';
import { parseGiltTable } from '@/lib/plan/gilt-parser';
import { FALLBACK_GILT_PRICES, LADDER } from '@/lib/plan/assumptions';

describe('ladder sizing (criterion F6)', () => {
  const plan = buildLadder(FALLBACK_GILT_PRICES);

  it('covers all 11 target years 2035–2045', () => {
    const years = new Set(plan.allocations.map((a) => a.targetYear));
    for (let y = 2035; y <= 2045; y++) expect(years.has(y)).toBe(true);
  });

  it('default sizing is by the £909.4k budget: total cost = budget ±0.5%, redemption £90–110k/yr', () => {
    expect(Math.abs(plan.totals.estCost - LADDER.budgetReal) / LADDER.budgetReal).toBeLessThan(0.005);
    const perYear = sizeByBudget(FALLBACK_GILT_PRICES, LADDER.budgetReal);
    expect(perYear).toBeGreaterThan(90_000);
    expect(perYear).toBeLessThan(110_000);
    for (const a of plan.allocations.filter((x) => x.note === '')) expect(a.realAmount).toBeCloseTo(perYear, 0);
  });

  it('cost per £1 real redemption is clean/100 (coupon-inclusive); the old fixed £60k/yr ladder still anchors on TR40', () => {
    const sixty = buildLadder(FALLBACK_GILT_PRICES, { amountPerYear: 60_000 });
    const tr40 = sixty.byGilt.find((g) => g.epic === 'TR40')!;
    expect(Math.abs(tr40.face - 31_204) / 31_204).toBeLessThan(0.01);
    expect(Math.abs(tr40.estCost - 48_696) / 48_696).toBeLessThan(0.01);
    expect(sixty.totals.estCost).toBeLessThan(0.7 * LADDER.budgetReal);
  });

  it('ISA bridge (2035–40) sized on its own £519.5k budget lands within 10% of the whole-ladder redemption', () => {
    const isa = sizeByBudget(FALLBACK_GILT_PRICES, LADDER.isaBudgetReal, { firstYear: 2035, lastYear: 2040 });
    const all = sizeByBudget(FALLBACK_GILT_PRICES, LADDER.budgetReal);
    expect(Math.abs(isa - all) / all).toBeLessThan(0.1);
  });

  it('2043 splits 50/50 across the 2042 and 2044 gilts', () => {
    const split = plan.allocations.filter((a) => a.targetYear === 2043);
    expect(split).toHaveLength(2);
    expect(split.map((a) => a.epic).sort()).toEqual(['T42A', 'T44']);
    const perYear = sizeByBudget(FALLBACK_GILT_PRICES, LADDER.budgetReal);
    for (const a of split) expect(a.realAmount).toBeCloseTo(perYear / 2, 0);
  });

  it('per-gilt cost = face/100 × dirty; totals are sums', () => {
    for (const g of plan.byGilt) {
      expect(g.estCost).toBeCloseTo((g.face / 100) * g.dirty, 0);
    }
    expect(plan.totals.estCost).toBeCloseTo(
      plan.byGilt.reduce((s, g) => s + g.estCost, 0),
      0
    );
  });

  it('supports the early-retirement variant (2032 start uses nearest maturities)', () => {
    const early = buildLadder(FALLBACK_GILT_PRICES, { firstYear: 2032, lastYear: 2040 });
    const y2032 = early.allocations.filter((a) => a.targetYear === 2032);
    expect(y2032.length).toBeGreaterThan(0);
    expect(y2032.every((a) => a.note.length > 0)).toBe(true); // no 2032 linker in fixture
  });
});

describe('gilt table parser (criterion F8/E1)', () => {
  const fixture = `
    <table><tr><th>Ticker</th><th>Name</th><th>Coupon</th><th>Maturity Date</th><th>TTM</th><th>Clean Price</th><th>Dirty Price</th><th>Real Yield</th><th></th></tr>
    <tr><td>TR35</td><td>1 1/8% Index-linked Treasury Gilt 2035</td><td>1.125%</td><td>22-Sep-2035</td><td>9 years</td><td>&pound;94.52</td><td>&pound;100.83</td><td>1.77%</td><td></td></tr>
    <tr><td>TR40</td><td>0 5/8% Index-linked Treasury Gilt 2040</td><td>0.625%</td><td>22-Mar-2040</td><td>13 years</td><td>&pound;81.15</td><td>&pound;156.06</td><td>2.23%</td><td></td></tr>
    <tr><td>BAD</td><td>Broken row</td><td>0%</td><td>not-a-date</td><td>—</td><td>&pound;x</td><td>&pound;y</td><td>z%</td><td></td></tr>
    </table>`;

  it('parses EPIC, prices, maturity year; skips header and malformed rows', () => {
    const gilts = parseGiltTable(fixture);
    expect(gilts).toHaveLength(2);
    expect(gilts[0]).toMatchObject({ epic: 'TR35', matYear: 2035, clean: 94.52, dirty: 100.83, realYield: 1.77 });
    expect(gilts[1].epic).toBe('TR40');
  });

  it('returns empty on garbage input rather than throwing', () => {
    expect(parseGiltTable('<html>nothing here</html>')).toEqual([]);
  });
});
