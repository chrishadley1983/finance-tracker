import { describe, it, expect } from 'vitest';
import { potsAtExit, sustainableSpend, drawdownSim, DEFAULT_OUTLOOK } from '@/lib/plan/outlook';

describe('outlook models (criteria F10, F11, E3)', () => {
  const base = DEFAULT_OUTLOOK;

  it('pots at 2035 baseline: Chris ~£756k, Abby ~£712k, total £2.29M ±3% (Sep 2026 pots, Sep-2026 payslip)', () => {
    // Chris: (442,488 + 193,081) × 1.02^9 = 759.6k (within 1% of 756k). Abby: 282,921 × 1.02^9 = 338k plus nine years of
    // payroll + 22.0k→34.8k sacrifice (real) compounding at 2% mid-year ≈ 705k at 11.4k payroll (Aug payslip, employer 11%);
    // the Sep 2026 payslip raised the employer rate to 12%: +0.74k a year × ~9.6 (nine years, 2%, mid-year) ≈ +7.1k → ≈ 712k.
    const p = potsAtExit(base);
    expect(Math.abs(p.chrisPension - 756_000) / 756_000).toBeLessThan(0.01);
    expect(Math.abs(p.abbyPension - 712_000) / 712_000).toBeLessThan(0.01);
    expect(Math.abs(p.total - 2_290_000) / 2_290_000).toBeLessThan(0.03);
  });

  it('sustainable spend at 2035 baseline is £95–100k', () => {
    const s = sustainableSpend(base);
    expect(s).toBeGreaterThan(95_000);
    expect(s).toBeLessThan(100_000);
  });

  it('surplus at 92, baseline = £2.21M ±5% (1 Sep 2026 pots; was £2.0M on the June pots and April payslip)', () => {
    const r = drawdownSim(base);
    expect(Math.abs(r.surplusAt92 - 2_210_000) / 2_210_000).toBeLessThan(0.05);
  });

  it('retire 2032: surplus ≈ £1.23M ±10% (sim compounds forgone wealth — supersedes doc chart)', () => {
    const r = drawdownSim({ ...base, retireYear: 2032 });
    expect(Math.abs(r.surplusAt92 - 1_230_000) / 1_230_000).toBeLessThan(0.1);
  });

  it('retire 2032: sustainable spend ≈ £80k ±3%', () => {
    const s = sustainableSpend({ ...base, retireYear: 2032 });
    expect(Math.abs(s - 80_000) / 80_000).toBeLessThan(0.03);
  });

  // 23 Sep 2026: the lump sum allowance and the personal allowance are now frozen in cash (worth less each
  // year in today's money), so the outlook pays more tax than the ≤4% / ≤£30k it showed when both were held real.
  it('baseline drawdown: effective tax ≤6%, total tax ≤£45k, first taxed year ≥2070 or never', () => {
    const r = drawdownSim(base);
    expect(r.effectiveTaxRate).toBeLessThanOrEqual(0.06);
    expect(r.totalTax).toBeLessThanOrEqual(45_000);
    if (r.firstTaxedYear !== null) expect(r.firstTaxedYear).toBeGreaterThanOrEqual(2070);
  });

  it('regression: doc-table pots (£747/£648/£820k) → surplus £2.00M ±3%, eff tax ≤6% (was £2.04M / ≤1% before the cash-frozen allowances)', () => {
    const r = drawdownSim({
      ...base,
      potsOverride: { chrisPension: 747_000, abbyPension: 648_000, nonPension: 820_000, total: 2_215_000 },
    });
    expect(Math.abs(r.surplusAt92 - 2_000_000) / 2_000_000).toBeLessThan(0.03);
    expect(r.effectiveTaxRate).toBeLessThanOrEqual(0.06);
  });

  it('4% real beats 2% real at every retirement year', () => {
    for (const y of [2031, 2033, 2035]) {
      const a = drawdownSim({ ...base, retireYear: y, realReturn: 0.04 }).surplusAt92;
      const b = drawdownSim({ ...base, retireYear: y, realReturn: 0.02 }).surplusAt92;
      expect(a).toBeGreaterThan(b);
    }
  });

  it('surplus rises monotonically with later retirement (2031→2035)', () => {
    let prev = -Infinity;
    for (let y = 2031; y <= 2035; y++) {
      const s = drawdownSim({ ...base, retireYear: y }).surplusAt92;
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });

  it('boundary grid produces finite outputs, no NaN (E3)', () => {
    for (const retireYear of [2031, 2035]) {
      for (const realReturn of [0.02, 0.04]) {
        for (const retirementSpend of [40_000, 60_000, 100_000]) {
          const opts = { ...base, retireYear, realReturn, retirementSpend };
          const r = drawdownSim(opts);
          expect(Number.isFinite(r.surplusAt92)).toBe(true);
          expect(Number.isFinite(r.totalTax)).toBe(true);
          expect(Number.isFinite(sustainableSpend(opts))).toBe(true);
          expect(Number.isFinite(potsAtExit(opts).total)).toBe(true);
        }
      }
    }
  });

  it('funding rows cover every year from exit to 2075', () => {
    const r = drawdownSim(base);
    expect(r.fundingByYear[0].year).toBe(2035);
    expect(r.fundingByYear[r.fundingByYear.length - 1].year).toBe(2075);
    expect(r.fundingByYear).toHaveLength(41);
  });
});
