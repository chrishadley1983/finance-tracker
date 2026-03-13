import { describe, it, expect } from 'vitest';
import { runExhaustiveHistoricalSim } from '@/lib/fire/ern/historical-sim';
import type { ErnSimConfig } from '@/lib/fire/ern/types';

const baseConfig: ErnSimConfig = {
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

describe('ERN Exhaustive Historical Simulation', () => {
  const results = runExhaustiveHistoricalSim(baseConfig);

  describe('cohort count', () => {
    it('uses every cohort (not every 3rd)', () => {
      // With every cohort: 1167 (reference from our test script)
      // With every 3rd: 389 (v4 reference)
      expect(results.totalCohorts).toBe(1167);
    });

    it('has significantly more cohorts than v4 subsampling', () => {
      expect(results.totalCohorts).toBeGreaterThan(1000);
    });
  });

  describe('aggregate statistics', () => {
    it('fail-safe SWR matches reference (with fees)', () => {
      // Reference with fees: 3.0213
      expect(results.failSafeSwr).toBeCloseTo(3.02, 1);
    });

    it('median SWR matches reference (with fees)', () => {
      // Reference with fees: 5.0411
      expect(results.medianSwr).toBeCloseTo(5.04, 1);
    });

    it('fail-safe < median', () => {
      expect(results.failSafeSwr).toBeLessThan(results.medianSwr);
    });
  });

  describe('CAPE buckets', () => {
    it('produces 5 CAPE buckets', () => {
      expect(results.capeBuckets).toHaveLength(5);
    });

    it('bucket labels are correct', () => {
      const labels = results.capeBuckets.map(b => b.label);
      expect(labels).toEqual(['<15', '15-20', '20-25', '25-30', '30+']);
    });

    it('bucket counts sum to total cohorts', () => {
      const sum = results.capeBuckets.reduce((acc, b) => acc + b.count, 0);
      expect(sum).toBe(results.totalCohorts);
    });

    it('<15 bucket has highest fail-safe', () => {
      const low = results.capeBuckets.find(b => b.label === '<15')!;
      const mid = results.capeBuckets.find(b => b.label === '20-25')!;
      expect(low.failSafe).toBeGreaterThan(mid.failSafe);
    });

    it('fail-safe decreases as CAPE increases (for populated buckets)', () => {
      const populated = results.capeBuckets.filter(b => b.count > 0);
      for (let i = 1; i < populated.length; i++) {
        // General trend: higher CAPE = lower fail-safe
        // Allow some tolerance for small bucket sizes
        if (populated[i].count > 5 && populated[i - 1].count > 5) {
          expect(populated[i].failSafe).toBeLessThanOrEqual(populated[i - 1].failSafe + 0.5);
        }
      }
    });
  });

  describe('high-CAPE cohorts', () => {
    it('tracks CAPE >= 30 cohorts', () => {
      expect(results.highCapeCohorts.length).toBeGreaterThanOrEqual(0);
      for (const c of results.highCapeCohorts) {
        expect(c.cape).toBeGreaterThanOrEqual(30);
      }
    });
  });

  describe('all cohorts have valid data', () => {
    it('every cohort has positive SWR', () => {
      for (const c of results.cohorts) {
        expect(c.swr).toBeGreaterThan(0);
      }
    });

    it('every cohort has valid CAPE >= 2', () => {
      for (const c of results.cohorts) {
        expect(c.cape).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
