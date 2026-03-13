import { describe, it, expect } from 'vitest';
import {
  computeErnDynamicWr,
  generateCapeWithdrawalCurve,
  computeCapeImpliedReturn,
  computeConditionalFailureTable,
} from '@/lib/fire/ern/cape-analysis';
import { runExhaustiveHistoricalSim } from '@/lib/fire/ern/historical-sim';
import type { ErnSimConfig, CohortResult } from '@/lib/fire/ern/types';

describe('ERN CAPE Analysis', () => {
  describe('computeErnDynamicWr', () => {
    it('CAPE 39 = 3.03%', () => {
      expect(computeErnDynamicWr(39)).toBeCloseTo(3.0321, 2);
    });

    it('CAPE 20 = 4.25%', () => {
      expect(computeErnDynamicWr(20)).toBeCloseTo(4.25, 2);
    });

    it('CAPE 15 = 5.08%', () => {
      expect(computeErnDynamicWr(15)).toBeCloseTo(5.0833, 2);
    });

    it('CAPE 10 = 6.75%', () => {
      expect(computeErnDynamicWr(10)).toBeCloseTo(6.75, 2);
    });

    it('caps at 10% for very low CAPE', () => {
      expect(computeErnDynamicWr(3)).toBe(10);
      expect(computeErnDynamicWr(5)).toBe(10);
    });

    it('returns 0 for CAPE <= 0', () => {
      expect(computeErnDynamicWr(0)).toBe(0);
      expect(computeErnDynamicWr(-5)).toBe(0);
    });

    it('formula: 1.75 + 0.50 * (100/CAPE)', () => {
      for (const cape of [12, 18, 25, 35]) {
        const expected = 1.75 + 0.50 * (100 / cape);
        expect(computeErnDynamicWr(cape)).toBeCloseTo(expected, 4);
      }
    });
  });

  describe('generateCapeWithdrawalCurve', () => {
    it('generates correct range of points', () => {
      const curve = generateCapeWithdrawalCurve(8, 44);
      expect(curve).toHaveLength(37);
      expect(curve[0].cape).toBe(8);
      expect(curve[curve.length - 1].cape).toBe(44);
    });

    it('rates decrease as CAPE increases', () => {
      const curve = generateCapeWithdrawalCurve();
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].withdrawalRate).toBeLessThanOrEqual(curve[i - 1].withdrawalRate);
      }
    });
  });

  describe('computeCapeImpliedReturn', () => {
    it('CAPE 39 implies ~2.56% real return', () => {
      expect(computeCapeImpliedReturn(39)).toBeCloseTo(2.564, 2);
    });

    it('CAPE 20 implies 5.0% real return', () => {
      expect(computeCapeImpliedReturn(20)).toBeCloseTo(5.0, 2);
    });

    it('CAPE 10 implies 10.0% real return', () => {
      expect(computeCapeImpliedReturn(10)).toBeCloseTo(10.0, 2);
    });

    it('returns 0 for CAPE <= 0', () => {
      expect(computeCapeImpliedReturn(0)).toBe(0);
    });
  });

  describe('computeConditionalFailureTable', () => {
    // Use a small synthetic dataset for fast, deterministic testing
    const syntheticCohorts: CohortResult[] = [
      { startIndex: 0, cape: 10, swr: 5.0 },
      { startIndex: 1, cape: 12, swr: 4.5 },
      { startIndex: 2, cape: 14, swr: 4.0 },
      { startIndex: 3, cape: 17, swr: 3.5 },
      { startIndex: 4, cape: 19, swr: 3.0 },
      { startIndex: 5, cape: 22, swr: 2.8 },
      { startIndex: 6, cape: 24, swr: 2.5 },
      { startIndex: 7, cape: 27, swr: 2.3 },
      { startIndex: 8, cape: 32, swr: 2.0 },
      { startIndex: 9, cape: 35, swr: 1.8 },
    ];

    it('produces rows for All + 5 CAPE buckets', () => {
      const table = computeConditionalFailureTable(syntheticCohorts, [3.0, 4.0]);
      expect(table.rows).toHaveLength(6);
      expect(table.rows[0].label).toBe('All');
    });

    it('All row counts all cohorts', () => {
      const table = computeConditionalFailureTable(syntheticCohorts, [3.0]);
      expect(table.rows[0].count).toBe(10);
    });

    it('computes correct failure rates', () => {
      const table = computeConditionalFailureTable(syntheticCohorts, [3.0]);
      // Cohorts with SWR < 3.0: cape 22 (2.8), 24 (2.5), 27 (2.3), 32 (2.0), 35 (1.8) = 5/10 = 50%
      expect(table.rows[0].failureRates['3.00']).toBe(50.0);
    });

    it('failure rate increases with higher test WR', () => {
      const table = computeConditionalFailureTable(syntheticCohorts, [2.0, 3.0, 4.0, 5.0]);
      const allRow = table.rows[0];
      expect(allRow.failureRates['2.00']).toBeLessThanOrEqual(allRow.failureRates['3.00']);
      expect(allRow.failureRates['3.00']).toBeLessThanOrEqual(allRow.failureRates['4.00']);
      expect(allRow.failureRates['4.00']).toBeLessThanOrEqual(allRow.failureRates['5.00']);
    });

    it('high-CAPE buckets have higher failure rates', () => {
      const table = computeConditionalFailureTable(syntheticCohorts, [3.0]);
      const low = table.rows.find(r => r.label === '<15')!;
      const high = table.rows.find(r => r.label === '30+')!;
      // <15 bucket: swr 5.0, 4.5, 4.0 — all > 3.0 — 0% failure
      expect(low.failureRates['3.00']).toBe(0);
      // 30+ bucket: swr 2.0, 1.8 — all < 3.0 — 100% failure
      expect(high.failureRates['3.00']).toBe(100);
    });

    it('empty buckets have 0% failure', () => {
      const table = computeConditionalFailureTable(syntheticCohorts, [3.0]);
      const bucket2530 = table.rows.find(r => r.label === '25-30')!;
      // Only cape 27 (swr 2.3) is in 25-30 — 100% fail at 3.0%
      expect(bucket2530.count).toBe(1);
      expect(bucket2530.failureRates['3.00']).toBe(100);
    });
  });

  describe('conditional failure table with real data', () => {
    const config: ErnSimConfig = {
      equityAllocation: 0.8,
      horizonYears: 48,
      preserveFraction: 0.5,
      glidepathEnabled: false,
      annualSpend: 50000,
      portfolio: 1538050,
      statePensionAnnual: 23000,
      statePensionStartAge: 67,
      currentAge: 42,
      gogoEnabled: false,
      guardrailEnabled: false,
      mcPaths: 500,
    };

    it('produces meaningful failure rates with real cohorts', () => {
      const results = runExhaustiveHistoricalSim(config);
      const table = computeConditionalFailureTable(results.cohorts);

      // At 3.0% WR, most cohorts should succeed (low failure rate)
      const allRow = table.rows[0];
      expect(allRow.failureRates['3.00']).toBeLessThan(5);

      // At 5.0% WR, many cohorts should fail
      expect(allRow.failureRates['5.00']).toBeGreaterThan(30);
    });
  });
});
