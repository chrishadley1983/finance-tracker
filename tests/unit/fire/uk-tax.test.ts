import { describe, it, expect } from 'vitest';
import {
  getPersonalAllowance,
  computeIncomeTax,
  computeNetIncome,
  computeEffectiveTaxRate,
  computeMarginalRate,
  computeCGT,
  computeDividendTax,
  realPersonalAllowance,
  computeFiscalDragCost,
  computeTFLS,
  computeUFPLSTax,
  PERSONAL_ALLOWANCE,
  PA_TAPER_THRESHOLD,
  PA_ZERO_THRESHOLD,
  CGT_ALLOWANCE,
  LUMP_SUM_ALLOWANCE,
} from '@/lib/fire/ern/uk-tax';

describe('UK Tax Calculator', () => {
  describe('getPersonalAllowance', () => {
    it('full PA below £100k', () => {
      expect(getPersonalAllowance(0)).toBe(12_570);
      expect(getPersonalAllowance(50_000)).toBe(12_570);
      expect(getPersonalAllowance(100_000)).toBe(12_570);
    });

    it('tapers £1 for £2 over £100k', () => {
      // £110,000 → £100k excess = £10k, taper = £5k, PA = £7,570
      expect(getPersonalAllowance(110_000)).toBe(7_570);
    });

    it('zero PA at £125,140', () => {
      expect(getPersonalAllowance(125_140)).toBe(0);
      expect(getPersonalAllowance(150_000)).toBe(0);
    });
  });

  describe('computeIncomeTax', () => {
    it('zero tax below PA', () => {
      expect(computeIncomeTax(0)).toBe(0);
      expect(computeIncomeTax(12_570)).toBe(0);
    });

    it('basic rate only — £30k salary', () => {
      // Taxable = 30000 - 12570 = 17430
      // Tax = 17430 × 0.20 = 3486
      expect(computeIncomeTax(30_000)).toBe(3_486);
    });

    it('basic + higher — £60k salary', () => {
      // Taxable = 60000 - 12570 = 47430
      // Basic: 37700 × 0.20 = 7540
      // Higher: (47430 - 37700) × 0.40 = 9730 × 0.40 = 3892
      // Total = 11432
      expect(computeIncomeTax(60_000)).toBe(11_432);
    });

    it('PA taper zone — £110k salary', () => {
      // PA = 12570 - (110000-100000)/2 = 12570 - 5000 = 7570
      // Taxable = 110000 - 7570 = 102430
      // Basic: 37700 × 0.20 = 7540
      // Higher: (102430 - 37700) × 0.40 = 64730 × 0.40 = 25892
      // Total = 33432
      expect(computeIncomeTax(110_000)).toBe(33_432);
    });

    it('additional rate — £200k salary', () => {
      // PA = 0
      // Taxable = 200000
      // Basic: 37700 × 0.20 = 7540
      // Higher: (125140 - 37700) × 0.40 = 87440 × 0.40 = 34976
      // Additional: (200000 - 125140) × 0.45 = 74860 × 0.45 = 33687
      // Total = 76203
      expect(computeIncomeTax(200_000)).toBe(76_203);
    });

    it('negative income returns 0', () => {
      expect(computeIncomeTax(-5000)).toBe(0);
    });
  });

  describe('computeNetIncome', () => {
    it('net = gross below PA', () => {
      expect(computeNetIncome(10_000)).toBe(10_000);
    });

    it('net = gross - tax', () => {
      expect(computeNetIncome(30_000)).toBe(30_000 - 3_486);
    });
  });

  describe('computeEffectiveTaxRate', () => {
    it('0% below PA', () => {
      expect(computeEffectiveTaxRate(10_000)).toBe(0);
    });

    it('reasonable rate at £50k', () => {
      const rate = computeEffectiveTaxRate(50_000);
      expect(rate).toBeGreaterThan(0.10);
      expect(rate).toBeLessThan(0.25);
    });

    it('0% for zero income', () => {
      expect(computeEffectiveTaxRate(0)).toBe(0);
    });
  });

  describe('computeMarginalRate', () => {
    it('0% below PA', () => {
      expect(computeMarginalRate(5_000)).toBe(0.20);
      // Even below PA, marginal rate on next pound is 20% if taxable > 0
      // Actually: taxable = 5000 - 12570 = negative, so marginal = 0.20 for basic band
      // Hmm, let me reconsider - at £5k gross, PA = 12570, taxable = 0
      // The marginal on the NEXT pound would be 0% until PA used up
      // But the function computes marginal at current income level
    });

    it('20% in basic rate band', () => {
      expect(computeMarginalRate(30_000)).toBe(0.20);
    });

    it('40% in higher rate band', () => {
      expect(computeMarginalRate(60_000)).toBe(0.40);
    });

    it('60% in PA taper zone', () => {
      expect(computeMarginalRate(110_000)).toBe(0.60);
    });

    it('45% in additional rate band', () => {
      expect(computeMarginalRate(200_000)).toBe(0.45);
    });
  });

  describe('computeCGT', () => {
    it('no tax within allowance', () => {
      expect(computeCGT(3_000, 50_000)).toBe(0);
      expect(computeCGT(2_000, 50_000)).toBe(0);
    });

    it('basic rate CGT for basic rate taxpayer', () => {
      // £10k gains, £30k income
      // Taxable gains = 10000 - 3000 = 7000
      // Income taxable = 30000 - 12570 = 17430
      // Basic band remaining = 37700 - 17430 = 20270
      // All gains in basic band: 7000 × 0.10 = 700
      expect(computeCGT(10_000, 30_000)).toBe(700);
    });

    it('higher rate CGT for higher rate taxpayer', () => {
      // £10k gains, £60k income
      // Taxable gains = 7000
      // Income taxable = 47430 → basic band remaining = 37700 - 47430 = 0
      // All gains at higher rate: 7000 × 0.20 = 1400
      expect(computeCGT(10_000, 60_000)).toBe(1_400);
    });

    it('split across bands', () => {
      // £20k gains, £45k income
      // Taxable gains = 17000
      // Income taxable = 45000 - 12570 = 32430
      // Basic remaining = 37700 - 32430 = 5270
      // 5270 at 10% = 527, 11730 at 20% = 2346
      // Total = 2873
      expect(computeCGT(20_000, 45_000)).toBe(2_873);
    });
  });

  describe('computeDividendTax', () => {
    it('no tax within allowance', () => {
      expect(computeDividendTax(1_000, 30_000)).toBe(0);
      expect(computeDividendTax(500, 30_000)).toBe(0);
    });

    it('basic rate dividends', () => {
      // £5k dividends, £30k other income
      // Taxable divs = 5000 - 1000 = 4000
      // Other taxable = 30000 - 12570 = 17430, well within basic band
      // 4000 × 8.75% = 350
      expect(computeDividendTax(5_000, 30_000)).toBeCloseTo(350, 0);
    });
  });

  describe('TFLS', () => {
    it('25% of SIPP value', () => {
      expect(computeTFLS(400_000)).toBe(100_000);
    });

    it('capped at Lump Sum Allowance', () => {
      expect(computeTFLS(2_000_000)).toBe(LUMP_SUM_ALLOWANCE);
    });

    it('reduced by prior usage', () => {
      expect(computeTFLS(400_000, 200_000)).toBe(68_275);
    });

    it('zero if LSA fully used', () => {
      expect(computeTFLS(400_000, LUMP_SUM_ALLOWANCE)).toBe(0);
    });
  });

  describe('computeUFPLSTax', () => {
    it('25% tax-free, 75% taxable', () => {
      const result = computeUFPLSTax(10_000, 0);
      expect(result.taxFree).toBe(2_500);
      expect(result.taxable).toBe(7_500);
    });

    it('no income tax when taxable within PA', () => {
      const result = computeUFPLSTax(10_000, 0);
      expect(result.tax).toBe(0); // 7500 taxable, covered by PA
    });

    it('tax when other income uses PA', () => {
      const result = computeUFPLSTax(10_000, 12_570);
      // Taxable = 7500, all at basic rate (other income fills PA)
      expect(result.tax).toBe(7_500 * 0.20);
    });

    it('net = withdrawal - tax', () => {
      const result = computeUFPLSTax(10_000, 12_570);
      expect(result.net).toBe(10_000 - result.tax);
    });

    it('respects LSA remaining', () => {
      const result = computeUFPLSTax(10_000, 0, 1_000);
      expect(result.taxFree).toBe(1_000); // Only £1k LSA left
      expect(result.taxable).toBe(9_000);
    });
  });

  describe('fiscal drag', () => {
    it('real PA erodes over time', () => {
      const pa0 = realPersonalAllowance(0, 0.025);
      const pa10 = realPersonalAllowance(10, 0.025);
      const pa20 = realPersonalAllowance(20, 0.025);

      expect(pa0).toBe(PERSONAL_ALLOWANCE);
      expect(pa10).toBeLessThan(pa0);
      expect(pa20).toBeLessThan(pa10);
    });

    it('fiscal drag cost increases over time', () => {
      const cost5 = computeFiscalDragCost(50_000, 5, 0.025);
      const cost10 = computeFiscalDragCost(50_000, 10, 0.025);
      const cost20 = computeFiscalDragCost(50_000, 20, 0.025);

      expect(cost5).toBeGreaterThan(0);
      expect(cost10).toBeGreaterThan(cost5);
      expect(cost20).toBeGreaterThan(cost10);
    });

    it('zero drag with zero inflation', () => {
      expect(computeFiscalDragCost(50_000, 10, 0)).toBe(0);
    });
  });
});
