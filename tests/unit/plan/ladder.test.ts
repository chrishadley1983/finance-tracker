import { describe, it, expect } from 'vitest';
import { buildLadder } from '@/lib/plan/ladder';
import { parseGiltTable } from '@/lib/plan/gilt-parser';
import { FALLBACK_GILT_PRICES } from '@/lib/plan/constants';

describe('ladder sizing (criterion F6)', () => {
  const plan = buildLadder(FALLBACK_GILT_PRICES);

  it('covers all 11 target years 2035–2045', () => {
    const years = new Set(plan.allocations.map((a) => a.targetYear));
    for (let y = 2035; y <= 2045; y++) expect(years.has(y)).toBe(true);
  });

  it('TR40 anchor: face £31,204 ±1%, cost £48,696 ±1%', () => {
    const tr40 = plan.byGilt.find((g) => g.epic === 'TR40')!;
    expect(Math.abs(tr40.face - 31_204) / 31_204).toBeLessThan(0.01);
    expect(Math.abs(tr40.estCost - 48_696) / 48_696).toBeLessThan(0.01);
  });

  it('2043 splits 50/50 across the 2042 and 2044 gilts', () => {
    const split = plan.allocations.filter((a) => a.targetYear === 2043);
    expect(split).toHaveLength(2);
    expect(split.map((a) => a.epic).sort()).toEqual(['T42A', 'T44']);
    for (const a of split) expect(a.realAmount).toBe(30_000);
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
