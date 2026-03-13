import { describe, it, expect } from 'vitest';
import { runMonteCarlo, createMcConfigFromErn } from '@/lib/fire/ern/monte-carlo';
import type { McConfig } from '@/lib/fire/ern/types';

const baseConfig: McConfig = {
  portfolio: 1538050,
  annualSpend: 50000,
  equityAllocation: 0.8,
  horizonMonths: 48 * 12,
  glidepathEnabled: false,
  statePensionMonthly: 23000 / 12,
  pensionStartMonth: (67 - 42) * 12,
  gogoEnabled: false,
  guardrailEnabled: false,
  paths: 500,
  seed: 42,
  currentAge: 42,
};

describe('ERN Monte Carlo Engine', () => {
  describe('deterministic PRNG', () => {
    it('same seed produces identical results', () => {
      const r1 = runMonteCarlo(baseConfig);
      const r2 = runMonteCarlo(baseConfig);
      expect(r1.survivalRate).toBe(r2.survivalRate);
      expect(r1.worstPathIndex).toBe(r2.worstPathIndex);
      expect(r1.paths[0]).toEqual(r2.paths[0]);
      expect(r1.paths[499]).toEqual(r2.paths[499]);
    });

    it('different seed produces different results', () => {
      const r1 = runMonteCarlo(baseConfig);
      const r2 = runMonteCarlo({ ...baseConfig, seed: 123 });
      // Very unlikely to be identical
      expect(r1.paths[0]).not.toEqual(r2.paths[0]);
    });
  });

  describe('path structure', () => {
    const results = runMonteCarlo(baseConfig);

    it('produces correct number of paths', () => {
      expect(results.paths).toHaveLength(500);
    });

    it('each path has correct number of yearly snapshots', () => {
      // 48 years = 48 yearly snapshots (t=0, t=12, ..., t=564)
      for (const path of results.paths) {
        expect(path).toHaveLength(48);
      }
    });

    it('first year values are all close to starting portfolio', () => {
      for (const path of results.paths) {
        // After 1 year of returns/withdrawals, should still be in reasonable range
        expect(path[0]).toBeGreaterThan(0);
        expect(path[0]).toBeLessThan(baseConfig.portfolio * 3);
      }
    });
  });

  describe('survival rate', () => {
    it('is in reasonable range for typical config', () => {
      const results = runMonteCarlo(baseConfig);
      // With pension offset and 80/20 allocation, expect high survival
      expect(results.survivalRate).toBeGreaterThanOrEqual(70);
      expect(results.survivalRate).toBeLessThanOrEqual(100);
    });

    it('higher spend = lower survival', () => {
      const low = runMonteCarlo({ ...baseConfig, annualSpend: 40000 });
      const high = runMonteCarlo({ ...baseConfig, annualSpend: 80000 });
      expect(low.survivalRate).toBeGreaterThanOrEqual(high.survivalRate);
    });

    it('larger portfolio = higher survival', () => {
      const small = runMonteCarlo({ ...baseConfig, portfolio: 1000000 });
      const large = runMonteCarlo({ ...baseConfig, portfolio: 2500000 });
      expect(large.survivalRate).toBeGreaterThanOrEqual(small.survivalRate);
    });
  });

  describe('percentiles', () => {
    const results = runMonteCarlo(baseConfig);

    it('has correct percentile arrays', () => {
      expect(results.percentiles.p5).toHaveLength(48);
      expect(results.percentiles.p25).toHaveLength(48);
      expect(results.percentiles.p50).toHaveLength(48);
      expect(results.percentiles.p75).toHaveLength(48);
      expect(results.percentiles.p95).toHaveLength(48);
    });

    it('percentiles are ordered correctly at each year', () => {
      for (let y = 0; y < 48; y++) {
        expect(results.percentiles.p5[y]).toBeLessThanOrEqual(results.percentiles.p25[y]);
        expect(results.percentiles.p25[y]).toBeLessThanOrEqual(results.percentiles.p50[y]);
        expect(results.percentiles.p50[y]).toBeLessThanOrEqual(results.percentiles.p75[y]);
        expect(results.percentiles.p75[y]).toBeLessThanOrEqual(results.percentiles.p95[y]);
      }
    });
  });

  describe('worst path', () => {
    const results = runMonteCarlo(baseConfig);

    it('worst path index is valid', () => {
      expect(results.worstPathIndex).toBeGreaterThanOrEqual(0);
      expect(results.worstPathIndex).toBeLessThan(500);
    });

    it('worst path matches the path at that index', () => {
      expect(results.worstPath).toEqual(results.paths[results.worstPathIndex]);
    });

    it('no path has a lower final value than the worst path', () => {
      const worstFinal = results.worstPath[results.worstPath.length - 1] ?? 0;
      for (const path of results.paths) {
        expect(path[path.length - 1] ?? 0).toBeGreaterThanOrEqual(worstFinal);
      }
    });
  });

  describe('pension offset', () => {
    it('pension reduces effective withdrawal after pension start', () => {
      const noPension = runMonteCarlo({
        ...baseConfig,
        statePensionMonthly: 0,
      });
      const withPension = runMonteCarlo(baseConfig);
      // With pension, survival should be higher
      expect(withPension.survivalRate).toBeGreaterThanOrEqual(noPension.survivalRate);
    });
  });

  describe('spending decline (corrected go-go model)', () => {
    it('spending decline improves survival vs flat spending', () => {
      const flat = runMonteCarlo({ ...baseConfig, gogoEnabled: false });
      const decline = runMonteCarlo({ ...baseConfig, gogoEnabled: true });
      // Late-retirement spending decline should improve survival
      expect(decline.survivalRate).toBeGreaterThanOrEqual(flat.survivalRate);
    });
  });

  describe('glidepath', () => {
    it('glidepath can be enabled', () => {
      const results = runMonteCarlo({ ...baseConfig, glidepathEnabled: true });
      expect(results.paths).toHaveLength(500);
      expect(results.survivalRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createMcConfigFromErn', () => {
    it('converts ErnSimConfig-like input to McConfig', () => {
      const mc = createMcConfigFromErn({
        portfolio: 1538050,
        annualSpend: 50000,
        equityAllocation: 0.8,
        horizonYears: 48,
        glidepathEnabled: false,
        statePensionAnnual: 23000,
        statePensionStartAge: 67,
        currentAge: 42,
        gogoEnabled: false,
        guardrailEnabled: false,
        mcPaths: 500,
      });

      expect(mc.horizonMonths).toBe(576);
      expect(mc.statePensionMonthly).toBeCloseTo(23000 / 12, 2);
      expect(mc.pensionStartMonth).toBe(300);
      expect(mc.seed).toBe(42);
    });
  });
});
