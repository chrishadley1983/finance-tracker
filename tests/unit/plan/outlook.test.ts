import { describe, it, expect } from 'vitest';
import { potsAtExit, sustainableSpend, drawdownSim, DEFAULT_OUTLOOK } from '@/lib/plan/outlook';

describe('outlook models (criteria F10, F11, E3)', () => {
  const base = DEFAULT_OUTLOOK;

  it('pots at 2035 baseline: Chris ~£747k, Abby ~£693k (Aug-2026 payslip), total £2.27M ±3%', () => {
    // Abby was £648k on the April payslip; +5.6% basic adds ~£4.4k/yr of sacrifice + £0.6k of existing contributions
    const p = potsAtExit(base);
    expect(Math.abs(p.chrisPension - 747_000) / 747_000).toBeLessThan(0.01);
    expect(Math.abs(p.abbyPension - 693_000) / 693_000).toBeLessThan(0.01);
    expect(Math.abs(p.total - 2_270_000) / 2_270_000).toBeLessThan(0.03);
  });

  it('sustainable spend at 2035 baseline is £95–100k', () => {
    const s = sustainableSpend(base);
    expect(s).toBeGreaterThan(95_000);
    expect(s).toBeLessThan(100_000);
  });

  it('surplus at 92, baseline = £2.17M ±5% (was £2.0M on the April payslip)', () => {
    const r = drawdownSim(base);
    expect(Math.abs(r.surplusAt92 - 2_170_000) / 2_170_000).toBeLessThan(0.05);
  });

  it('retire 2032: surplus ≈ £1.18M ±10% (sim compounds forgone wealth — supersedes doc chart)', () => {
    const r = drawdownSim({ ...base, retireYear: 2032 });
    expect(Math.abs(r.surplusAt92 - 1_180_000) / 1_180_000).toBeLessThan(0.1);
  });

  it('retire 2032: sustainable spend ≈ £80k ±3%', () => {
    const s = sustainableSpend({ ...base, retireYear: 2032 });
    expect(Math.abs(s - 80_000) / 80_000).toBeLessThan(0.03);
  });

  it('baseline drawdown: effective tax ≤4%, total tax ≤£30k, first taxed year ≥2070 or never', () => {
    const r = drawdownSim(base);
    expect(r.effectiveTaxRate).toBeLessThanOrEqual(0.04);
    expect(r.totalTax).toBeLessThanOrEqual(30_000);
    if (r.firstTaxedYear !== null) expect(r.firstTaxedYear).toBeGreaterThanOrEqual(2070);
  });

  it('regression: doc-table pots (£747/£648/£820k) → surplus £2.04M ±3%, eff tax ≤1%', () => {
    const r = drawdownSim({
      ...base,
      potsOverride: { chrisPension: 747_000, abbyPension: 648_000, nonPension: 820_000, total: 2_215_000 },
    });
    expect(Math.abs(r.surplusAt92 - 2_040_000) / 2_040_000).toBeLessThan(0.03);
    expect(r.effectiveTaxRate).toBeLessThanOrEqual(0.01);
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
