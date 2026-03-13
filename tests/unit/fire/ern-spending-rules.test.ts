import { describe, it, expect } from 'vitest';
import {
  applySpendingDecline,
  applyPensionOffset,
  applyGuardrail,
  computeCapeBasedWithdrawal,
  computePensionPV,
  computePart54AdjustedWithdrawal,
} from '@/lib/fire/ern/spending-rules';

describe('ERN Spending Rules', () => {
  describe('applySpendingDecline', () => {
    const w = 4000; // £4k/month

    it('no change before age 75', () => {
      expect(applySpendingDecline(w, 42)).toBe(w);
      expect(applySpendingDecline(w, 65)).toBe(w);
      expect(applySpendingDecline(w, 74.9)).toBe(w);
    });

    it('0.90× at age 75-79', () => {
      expect(applySpendingDecline(w, 75)).toBe(w * 0.90);
      expect(applySpendingDecline(w, 77)).toBe(w * 0.90);
      expect(applySpendingDecline(w, 79.9)).toBe(w * 0.90);
    });

    it('0.80× at age 80+', () => {
      expect(applySpendingDecline(w, 80)).toBe(w * 0.80);
      expect(applySpendingDecline(w, 90)).toBe(w * 0.80);
    });
  });

  describe('applyPensionOffset', () => {
    const w = 4000;
    const pension = 1917; // £23k / 12

    it('no change before pension starts', () => {
      expect(applyPensionOffset(w, pension, 0, 300)).toBe(w);
      expect(applyPensionOffset(w, pension, 299, 300)).toBe(w);
    });

    it('reduces withdrawal after pension starts', () => {
      expect(applyPensionOffset(w, pension, 300, 300)).toBeCloseTo(w - pension, 0);
      expect(applyPensionOffset(w, pension, 400, 300)).toBeCloseTo(w - pension, 0);
    });

    it('never goes below 0', () => {
      expect(applyPensionOffset(1000, 2000, 300, 300)).toBe(0);
    });
  });

  describe('applyGuardrail', () => {
    it('no change when portfolio above threshold', () => {
      expect(applyGuardrail(4000, 1000000, 1000000)).toBe(4000);
      expect(applyGuardrail(4000, 900000, 1000000)).toBe(4000);
    });

    it('cuts spending when below threshold', () => {
      expect(applyGuardrail(4000, 700000, 1000000)).toBe(4000 * 0.85);
      expect(applyGuardrail(4000, 500000, 1000000)).toBe(4000 * 0.85);
    });

    it('uses custom threshold and cut', () => {
      // 70% threshold, 30% cut
      expect(applyGuardrail(4000, 600000, 1000000, 0.7, 0.70)).toBe(4000 * 0.70);
      expect(applyGuardrail(4000, 750000, 1000000, 0.7, 0.70)).toBe(4000); // above threshold
    });
  });

  describe('computeCapeBasedWithdrawal', () => {
    it('CAPE 39: monthly withdrawal matches ERN formula', () => {
      const monthly = computeCapeBasedWithdrawal(1538050, 39);
      const expectedAnnual = 1538050 * (1.75 + 0.50 * (100 / 39)) / 100;
      expect(monthly).toBeCloseTo(expectedAnnual / 12, 0);
    });

    it('CAPE 20: higher withdrawal rate', () => {
      const at39 = computeCapeBasedWithdrawal(1000000, 39);
      const at20 = computeCapeBasedWithdrawal(1000000, 20);
      expect(at20).toBeGreaterThan(at39);
    });

    it('caps at 10%', () => {
      const monthly = computeCapeBasedWithdrawal(1000000, 3);
      const annualRate = (monthly * 12) / 1000000 * 100;
      expect(annualRate).toBeCloseTo(10, 0);
    });

    it('returns 0 for CAPE <= 0', () => {
      expect(computeCapeBasedWithdrawal(1000000, 0)).toBe(0);
    });

    it('accepts custom intercept and slope', () => {
      const monthly = computeCapeBasedWithdrawal(1000000, 20, 2.0, 0.60);
      const expectedRate = 2.0 + 0.60 * (100 / 20);
      expect(monthly * 12).toBeCloseTo(1000000 * expectedRate / 100, 0);
    });
  });

  describe('computePensionPV', () => {
    it('discounts future pension income correctly', () => {
      // £23k/yr starting in 25 years, lasting 23 years, 3% discount rate
      const pv = computePensionPV(23000, 25, 23, 0.03);
      expect(pv).toBeGreaterThan(100000);
      expect(pv).toBeLessThan(400000);
    });

    it('higher discount rate = lower PV', () => {
      const pvLow = computePensionPV(23000, 25, 23, 0.02);
      const pvHigh = computePensionPV(23000, 25, 23, 0.05);
      expect(pvLow).toBeGreaterThan(pvHigh);
    });

    it('sooner pension = higher PV', () => {
      const pvSoon = computePensionPV(23000, 10, 23, 0.03);
      const pvLate = computePensionPV(23000, 25, 23, 0.03);
      expect(pvSoon).toBeGreaterThan(pvLate);
    });

    it('longer pension = higher PV', () => {
      const pvShort = computePensionPV(23000, 25, 15, 0.03);
      const pvLong = computePensionPV(23000, 25, 30, 0.03);
      expect(pvLong).toBeGreaterThan(pvShort);
    });

    it('returns 0 for zero pension', () => {
      expect(computePensionPV(0, 25, 23, 0.03)).toBe(0);
    });
  });

  describe('computePart54AdjustedWithdrawal', () => {
    it('returns higher withdrawal than base CAPE rule due to pension', () => {
      const baseMonthly = computeCapeBasedWithdrawal(1538050, 39);
      const baseAnnual = baseMonthly * 12;

      const adjustedAnnual = computePart54AdjustedWithdrawal(
        1538050,
        39,
        23000,  // pension
        25,     // years until pension
        23,     // years of pension
        48,     // horizon
        0.5,    // preserve 50%
      );

      expect(adjustedAnnual).toBeGreaterThan(baseAnnual);
    });

    it('no pension = close to base CAPE rule', () => {
      const adjustedAnnual = computePart54AdjustedWithdrawal(
        1538050,
        39,
        0,      // no pension
        25,
        23,
        48,
        0,      // no preservation
      );

      const baseMonthly = computeCapeBasedWithdrawal(1538050, 39);
      const baseAnnual = baseMonthly * 12;

      // Should be close-ish to base (PMT adjusts for depletion)
      expect(adjustedAnnual).toBeGreaterThan(baseAnnual * 0.8);
      expect(adjustedAnnual).toBeLessThan(baseAnnual * 1.5);
    });

    it('higher preservation = lower withdrawal', () => {
      const deplete = computePart54AdjustedWithdrawal(1538050, 39, 23000, 25, 23, 48, 0);
      const preserve = computePart54AdjustedWithdrawal(1538050, 39, 23000, 25, 23, 48, 0.5);
      expect(deplete).toBeGreaterThan(preserve);
    });
  });
});
