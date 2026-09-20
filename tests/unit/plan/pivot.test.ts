import { describe, it, expect } from 'vitest';
import { pivotProgramme, pivotYear, childBenefitKept, currentRetune, netPay, takeHomeNominal } from '@/lib/plan/pivot';

describe('pivot model (criteria F4, F5, E3) — rebased to the Aug 2026 payslip (basic £73,837.80)', () => {
  it('netPay reconciles the Apr and Aug 2026 payslips to within £1/mo', () => {
    // cash = basic × 0.955 + car £541.67; taxable = cash + medical £110.83; code 1117L
    const apr = netPay((5_825 * 0.955 + 541.67) * 12, (5_825 * 0.955 + 541.67 + 110.83) * 12) / 12;
    const aug = netPay((6_153.15 * 0.955 + 541.67) * 12, (6_153.15 * 0.955 + 541.67 + 110.83) * 12) / 12;
    expect(Math.abs(apr - 4_330.1)).toBeLessThan(1);
    expect(Math.abs(aug - 4_511.6)).toBeLessThan(1);
  });

  it('take-home at the £60k target is £43.5k incl. bonus, whatever the basic', () => {
    const y = pivotYear(0, 60_000);
    expect(Math.abs(takeHomeNominal(0, y.extraSacrifice) - 43_498)).toBeLessThan(60);
  });

  it('year-1 extra sacrifice at £60k target is £22,037 ±£50 (ANI-before £82,037)', () => {
    // 73,837.80 × 1.005 + 6,500 + 1,330 + 5% bonus 3,691.89 − 60,000
    expect(Math.abs(pivotYear(0, 60_000).extraSacrifice - 22_037)).toBeLessThan(50);
  });

  it('year-9 extra sacrifice at £60k target is £34,776 ±£50', () => {
    // basic 73,837.80 × 1.02^8 = 86,513 → ANI-before 94,776
    expect(Math.abs(pivotYear(8, 60_000).extraSacrifice - 34_776)).toBeLessThan(50);
  });

  it('cumulative 9-year sacrifice at £60k is £254,330 ±£500', () => {
    // 1.005 × 73,837.80 × Σ1.02^i (i=0..8, 9.7546) − 9 × 52,170
    expect(Math.abs(pivotProgramme(60_000).totals.extraSacrifice - 254_330)).toBeLessThan(500);
  });

  it('year-1 take-home cut at £60k is £12,781 ±£50 (42% relief)', () => {
    expect(Math.abs(pivotYear(0, 60_000).takeHomeCut - 12_781)).toBeLessThan(50);
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

  it('net cost year 1 at £60k is −£10,444 ±£60 (cut − CB kept)', () => {
    expect(Math.abs(pivotYear(0, 60_000).netCost - 10_444)).toBeLessThan(60);
  });

  it('AVC% recipe: 31% at £59,500, 30% at £60,000 (year 1, full-year basis)', () => {
    expect(pivotYear(0, 59_500).avcPct).toBe(31);
    expect(pivotYear(0, 60_000).avcPct).toBe(30);
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
    // ANI stays ≈£82,037 — already above the £80k upper threshold → nothing kept
    expect(y.aniBefore).toBeGreaterThan(80_000);
    expect(y.cbKept).toBe(0);
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
    expect(r?.avcPct).toBe(31);
    const early = currentRetune(59_500, new Date('2027-03-30'));
    expect(early?.taxYear).toBe('2026/27'); // pre-6-April still 2026/27
    expect(currentRetune(59_500, new Date('2036-05-01'))).toBeNull();
  });
});
