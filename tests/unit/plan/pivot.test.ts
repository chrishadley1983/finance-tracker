import { describe, it, expect } from 'vitest';
import { pivotProgramme, pivotYear, childBenefitKept, currentRetune } from '@/lib/plan/pivot';

describe('pivot model (criteria F4, F5, E3)', () => {
  it('year-1 extra sacrifice at £60k target is £18,080 ±£50', () => {
    expect(pivotYear(0, 60_000).extraSacrifice).toBeCloseTo(18_080, -2);
  });

  it('year-9 extra sacrifice at £60k target is £30,138 ±£50', () => {
    expect(Math.abs(pivotYear(8, 60_000).extraSacrifice - 30_138)).toBeLessThan(50);
  });

  it('cumulative 9-year sacrifice at £60k is £215,728 ±£500', () => {
    expect(Math.abs(pivotProgramme(60_000).totals.extraSacrifice - 215_728)).toBeLessThan(500);
  });

  it('year-1 take-home cut at £60k is £10,486 ±£50 (42% relief)', () => {
    expect(Math.abs(pivotYear(0, 60_000).takeHomeCut - 10_486)).toBeLessThan(50);
  });

  it('CB kept in full at £60k target (£2,337 year 1)', () => {
    expect(pivotYear(0, 60_000).cbKept).toBeCloseTo(2_337.4, 0);
  });

  it('CB kept at £70k target is 50% ±2%', () => {
    const y = pivotYear(0, 70_000);
    expect(y.cbKept / y.cbFull).toBeGreaterThan(0.48);
    expect(y.cbKept / y.cbFull).toBeLessThan(0.52);
  });

  it('CB is zero at/above £80k; sacrifice still computed (relief-only mode)', () => {
    const y = pivotYear(0, 78_079);
    expect(childBenefitKept(80_000, 2_337)).toBe(0);
    expect(childBenefitKept(85_000, 2_337)).toBe(0);
    expect(y.extraSacrifice).toBeGreaterThan(0);
  });

  it('net cost year 1 at £60k is −£8,149 ±£60 (cut − CB kept)', () => {
    expect(Math.abs(pivotYear(0, 60_000).netCost - 8_149)).toBeLessThan(60);
  });

  it('AVC% recipe: 27% at £59,500, 26% at £60,000 (year 1)', () => {
    expect(pivotYear(0, 59_500).avcPct).toBe(27);
    expect(pivotYear(0, 60_000).avcPct).toBe(26);
  });

  it('relief blends to 28% below the £50,270 floor', () => {
    const deep = pivotYear(0, 40_000); // sacrifice band crosses the floor
    const shallow = pivotYear(0, 60_000);
    const deepAvg = 1 - deep.takeHomeCut / deep.extraSacrifice;
    const shallowAvg = 1 - shallow.takeHomeCut / shallow.extraSacrifice;
    expect(shallowAvg).toBeCloseTo(0.42, 2);
    expect(deepAvg).toBeLessThan(0.42);
    expect(deepAvg).toBeGreaterThan(0.28);
  });

  it('target above current ANI gives zero sacrifice and taper-only CB (E3)', () => {
    const y = pivotYear(0, 90_000);
    expect(y.extraSacrifice).toBe(0);
    expect(y.takeHomeCut).toBe(0);
    // ANI stays ≈£78,080 → 90 taper steps → ~10% of CB kept (~£234)
    expect(y.cbKept).toBeGreaterThan(150);
    expect(y.cbKept).toBeLessThan(350);
  });

  it('boundary inputs produce finite numbers across the grid (E3)', () => {
    for (const target of [50_270, 59_500, 60_000, 80_000, 100_000]) {
      for (let i = 0; i < 9; i++) {
        const y = pivotYear(i, target);
        for (const v of [y.extraSacrifice, y.takeHomeCut, y.cbKept, y.netCost, y.avcPct]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });

  it('currentRetune returns the active tax year row and null after the programme', () => {
    const r = currentRetune(59_500, new Date('2026-07-30'));
    expect(r?.taxYear).toBe('2026/27');
    expect(r?.avcPct).toBe(27);
    const early = currentRetune(59_500, new Date('2027-03-30'));
    expect(early?.taxYear).toBe('2026/27'); // pre-6-April still 2026/27
    expect(currentRetune(59_500, new Date('2036-05-01'))).toBeNull();
  });
});
