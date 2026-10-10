import { describe, it, expect } from 'vitest';
import {
  computeOptimalDrawdown,
  projectDrawdown,
  suggestCGTHarvest,
} from '@/lib/fire/ern/uk-drawdown';
import type { WrapperBalances, DrawdownConfig } from '@/lib/fire/ern/uk-drawdown';
import { CGT_ALLOWANCE, PERSONAL_ALLOWANCE } from '@/lib/fire/ern/uk-tax';

const defaultBalances: WrapperBalances = {
  isa: 500_000,
  sipp: 800_000,
  gia: 200_000,
  cash: 20_000,
};

describe('UK Drawdown Optimiser', () => {
  describe('computeOptimalDrawdown — pre-pension', () => {
    const baseConfig: DrawdownConfig = {
      annualSpend: 50_000,
      balances: defaultBalances,
      statePensionAnnual: 11_500,
      receivingStatePension: false,
    };

    it('draws SIPP first up to PA, then ISA', () => {
      const result = computeOptimalDrawdown(baseConfig);

      // Should draw £12,570 from SIPP (fills PA = zero tax)
      expect(result.fromSipp).toBe(PERSONAL_ALLOWANCE);
      // Remainder from ISA: 50000 - 12570 = 37430
      expect(result.fromIsa).toBe(50_000 - PERSONAL_ALLOWANCE);
      expect(result.fromGia).toBe(0);
      expect(result.fromCash).toBe(0);
    });

    it('pays zero income tax when SIPP within PA', () => {
      const result = computeOptimalDrawdown(baseConfig);
      expect(result.incomeTax).toBe(0);
    });

    it('total net equals annual spend (no tax)', () => {
      const result = computeOptimalDrawdown(baseConfig);
      expect(result.netIncome).toBe(50_000);
    });

    it('updates remaining balances correctly', () => {
      const result = computeOptimalDrawdown(baseConfig);
      expect(result.remainingBalances.sipp).toBe(800_000 - PERSONAL_ALLOWANCE);
      expect(result.remainingBalances.isa).toBe(500_000 - (50_000 - PERSONAL_ALLOWANCE));
      expect(result.remainingBalances.gia).toBe(200_000);
      expect(result.remainingBalances.cash).toBe(20_000);
    });
  });

  describe('computeOptimalDrawdown — post-pension', () => {
    const baseConfig: DrawdownConfig = {
      annualSpend: 50_000,
      balances: defaultBalances,
      statePensionAnnual: 11_500,
      receivingStatePension: true,
    };

    it('draws ISA first when receiving state pension', () => {
      const result = computeOptimalDrawdown(baseConfig);

      // Spending gap = 50000 - 11500 = 38500
      // All from ISA (tax-free)
      expect(result.fromIsa).toBe(38_500);
      expect(result.fromSipp).toBe(0);
    });

    it('pays tax only on state pension (covered by PA)', () => {
      const result = computeOptimalDrawdown(baseConfig);
      // State pension = 11500, below PA = 12570, so no tax
      expect(result.incomeTax).toBe(0);
    });

    it('falls back to SIPP when ISA insufficient', () => {
      const config: DrawdownConfig = {
        ...baseConfig,
        balances: { ...defaultBalances, isa: 10_000 },
      };
      const result = computeOptimalDrawdown(config);

      // Gap = 38500, ISA covers 10000; the SIPP covers the other 28500 AND the tax on itself:
      // x = 28500 + 0.2 × (11500 + x − 12570)  →  x = 35357.50
      expect(result.fromIsa).toBe(10_000);
      expect(result.fromSipp).toBeCloseTo(35_357.5, -0);
      expect(result.netIncome).toBeCloseTo(50_000, -0); // spend fully met after tax
    });

    it('SIPP drawdown is taxed when state pension fills PA', () => {
      const config: DrawdownConfig = {
        ...baseConfig,
        balances: { ...defaultBalances, isa: 10_000 },
      };
      const result = computeOptimalDrawdown(config);

      // Total taxable = 11500 (pension) + 35357.50 (grossed-up SIPP) = 46857.50
      // Tax = (46857.50 − 12570) × 0.20 = 6857.50 — and the pots pay it
      expect(result.incomeTax).toBeCloseTo(6_857.5, -0);
    });
  });

  describe('computeOptimalDrawdown — between 57 and State Pension age', () => {
    it('funds the whole spend from the SIPP once the ISA is gone, tax included', () => {
      const r = computeOptimalDrawdown({
        annualSpend: 50_000,
        balances: { isa: 0, sipp: 780_000, gia: 0, cash: 0 },
        statePensionAnnual: 11_500,
        receivingStatePension: false,
        canAccessSipp: true,
      });
      // Used to stop at the £12,570 personal allowance and leave £37k unfunded
      expect(r.netIncome).toBeCloseTo(50_000, -0);
      expect(r.fromSipp).toBeGreaterThan(50_000);
    });

    it('pots pay nothing when the State Pension covers spend and its own tax', () => {
      const r = computeOptimalDrawdown({
        annualSpend: 15_000,
        balances: { isa: 100_000, sipp: 0, gia: 0, cash: 0 },
        statePensionAnnual: 23_000,
        receivingStatePension: true,
      });
      expect(r.fromIsa).toBe(0);
    });
  });

  describe('computeOptimalDrawdown — GIA and cash fallback', () => {
    it('uses GIA when ISA and SIPP exhausted', () => {
      const config: DrawdownConfig = {
        annualSpend: 50_000,
        balances: { isa: 0, sipp: 0, gia: 200_000, cash: 20_000 },
        statePensionAnnual: 11_500,
        receivingStatePension: true,
      };
      const result = computeOptimalDrawdown(config);

      // 38500 gap plus the CGT on the GIA sale, so the spend is met after tax
      expect(result.fromGia).toBeGreaterThan(38_500);
      expect(result.fromGia - result.cgt).toBeCloseTo(38_500, -0);
      expect(result.fromCash).toBe(0);
    });

    it('uses cash as last resort', () => {
      const config: DrawdownConfig = {
        annualSpend: 50_000,
        balances: { isa: 0, sipp: 0, gia: 0, cash: 50_000 },
        statePensionAnnual: 11_500,
        receivingStatePension: true,
      };
      const result = computeOptimalDrawdown(config);

      expect(result.fromCash).toBe(38_500);
    });

    it('applies CGT on GIA gains', () => {
      const config: DrawdownConfig = {
        annualSpend: 50_000,
        balances: { isa: 0, sipp: 0, gia: 200_000, cash: 20_000 },
        statePensionAnnual: 11_500,
        receivingStatePension: true,
        giaGainFraction: 0.5,
      };
      const result = computeOptimalDrawdown(config);

      // GIA drawn = 38500, gains = 19250
      // CGT: (19250 - 3000) × rate
      expect(result.cgt).toBeGreaterThan(0);
    });
  });

  describe('projectDrawdown', () => {
    it('produces correct number of years', () => {
      const result = projectDrawdown({
        currentAge: 42,
        statePensionAge: 67,
        statePensionAnnual: 11_500,
        annualSpend: 50_000,
        balances: defaultBalances,
        realReturn: 0.04,
        horizonYears: 48,
      });

      expect(result.years).toHaveLength(48);
    });

    it('switches strategy at state pension age', () => {
      const result = projectDrawdown({
        currentAge: 42,
        statePensionAge: 67,
        statePensionAnnual: 11_500,
        annualSpend: 50_000,
        balances: defaultBalances,
        realReturn: 0.04,
        horizonYears: 48,
      });

      // Before SIPP access age (57): no SIPP drawn
      const preSippAccess = result.years[0]; // Age 42
      expect(preSippAccess.fromSipp).toBe(0);

      // After SIPP access, pre-pension: SIPP drawn to fill PA
      const postSippAccess = result.years[15]; // Age 57
      expect(postSippAccess.fromSipp).toBeGreaterThan(0);

      // Post-pension: ISA drawn first (if available)
      const postPension = result.years[25]; // Age 67
      expect(postPension.statePensionIncome).toBe(11_500);
    });

    it('tracks cumulative tax', () => {
      const result = projectDrawdown({
        currentAge: 42,
        statePensionAge: 67,
        statePensionAnnual: 11_500,
        annualSpend: 50_000,
        balances: defaultBalances,
        realReturn: 0.04,
        horizonYears: 48,
      });

      expect(result.totalTaxPaid).toBeGreaterThanOrEqual(0);
      expect(result.totalDrawn).toBeGreaterThan(0);
    });

    it('pre-pension years pay minimal tax', () => {
      const result = projectDrawdown({
        currentAge: 42,
        statePensionAge: 67,
        statePensionAnnual: 11_500,
        annualSpend: 50_000,
        balances: defaultBalances,
        realReturn: 0.04,
        horizonYears: 10,
      });

      // All pre-pension: SIPP within PA = zero tax
      for (const year of result.years) {
        expect(year.incomeTax).toBe(0);
      }
    });
  });

  describe('suggestCGTHarvest', () => {
    it('suggests harvesting up to CGT allowance', () => {
      const result = suggestCGTHarvest(200_000, 0.5, 50_000);
      expect(result.suggestedGain).toBe(CGT_ALLOWANCE);
    });

    it('tax cost is zero within allowance', () => {
      const result = suggestCGTHarvest(200_000, 0.5, 50_000);
      expect(result.taxCost).toBe(0);
    });

    it('suggests correct sell amount', () => {
      const result = suggestCGTHarvest(200_000, 0.5, 50_000);
      // Need to sell £6k to realise £3k gain at 50% gain fraction
      expect(result.sellAmount).toBe(6_000);
    });

    it('handles low-gain GIA', () => {
      const result = suggestCGTHarvest(200_000, 0.01, 50_000);
      // Total gain = £2k, less than allowance
      expect(result.suggestedGain).toBe(2_000);
    });

    it('handles zero gain fraction', () => {
      const result = suggestCGTHarvest(200_000, 0, 50_000);
      expect(result.suggestedGain).toBe(0);
      expect(result.sellAmount).toBe(0);
    });
  });
});
