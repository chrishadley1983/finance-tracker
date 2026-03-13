import { describe, it, expect } from 'vitest';
import {
  computeEquityAllocation,
  shouldUseGlidepath,
  getEffectiveStartEquity,
  DEFAULT_GLIDEPATH_MONTHS,
  DEFAULT_GLIDEPATH_START_EQUITY,
  CAPE_GLIDEPATH_THRESHOLD,
} from '@/lib/fire/ern/glidepath';

describe('ERN Glidepath', () => {
  describe('constants', () => {
    it('has correct defaults per ERN Parts 19, 20', () => {
      expect(DEFAULT_GLIDEPATH_MONTHS).toBe(120);
      expect(DEFAULT_GLIDEPATH_START_EQUITY).toBe(0.60);
      expect(CAPE_GLIDEPATH_THRESHOLD).toBe(20);
    });
  });

  describe('computeEquityAllocation', () => {
    it('returns baseEquity when disabled', () => {
      expect(computeEquityAllocation(0.6, 0, false)).toBe(0.6);
      expect(computeEquityAllocation(0.6, 60, false)).toBe(0.6);
      expect(computeEquityAllocation(0.6, 120, false)).toBe(0.6);
      expect(computeEquityAllocation(0.6, 999, false)).toBe(0.6);
    });

    it('starts at baseEquity at month 0', () => {
      expect(computeEquityAllocation(0.6, 0, true)).toBe(0.6);
    });

    it('ramps linearly to 100% over glidepathMonths', () => {
      // Midpoint: 60 months into 120-month ramp
      // eq = 0.6 + (1 - 0.6) * (60/120) = 0.6 + 0.2 = 0.8
      expect(computeEquityAllocation(0.6, 60, true)).toBeCloseTo(0.8, 10);
    });

    it('reaches 100% at glidepathMonths', () => {
      expect(computeEquityAllocation(0.6, 120, true)).toBeCloseTo(1.0, 10);
    });

    it('stays at 100% after glidepath completes', () => {
      expect(computeEquityAllocation(0.6, 150, true)).toBe(1.0);
      expect(computeEquityAllocation(0.6, 999, true)).toBe(1.0);
    });

    it('works with custom glidepath duration', () => {
      // 60-month ramp: at month 30, eq = 0.6 + 0.4 * (30/60) = 0.8
      expect(computeEquityAllocation(0.6, 30, true, 60)).toBeCloseTo(0.8, 10);
      // At month 60, should be 1.0
      expect(computeEquityAllocation(0.6, 60, true, 60)).toBeCloseTo(1.0, 10);
    });

    it('works with different starting equity', () => {
      // Start at 80%: at month 60 of 120, eq = 0.8 + 0.2 * 0.5 = 0.9
      expect(computeEquityAllocation(0.8, 60, true)).toBeCloseTo(0.9, 10);
    });

    it('handles 100% starting equity (no ramp needed)', () => {
      expect(computeEquityAllocation(1.0, 0, true)).toBe(1.0);
      expect(computeEquityAllocation(1.0, 60, true)).toBe(1.0);
    });

    it('never exceeds 1.0', () => {
      expect(computeEquityAllocation(0.6, 200, true)).toBe(1.0);
      expect(computeEquityAllocation(0.99, 200, true)).toBe(1.0);
    });
  });

  describe('shouldUseGlidepath', () => {
    it('returns false when user did not request glidepath', () => {
      expect(shouldUseGlidepath(30, false)).toBe(false);
      expect(shouldUseGlidepath(10, false)).toBe(false);
    });

    it('returns true when CAPE >= 20 and user requested', () => {
      expect(shouldUseGlidepath(20, true)).toBe(true);
      expect(shouldUseGlidepath(30, true)).toBe(true);
      expect(shouldUseGlidepath(39, true)).toBe(true);
    });

    it('returns false when CAPE < 20 even if user requested', () => {
      expect(shouldUseGlidepath(19, true)).toBe(false);
      expect(shouldUseGlidepath(10, true)).toBe(false);
      expect(shouldUseGlidepath(5, true)).toBe(false);
    });

    it('returns true at exact threshold', () => {
      expect(shouldUseGlidepath(20, true)).toBe(true);
    });
  });

  describe('getEffectiveStartEquity', () => {
    it('returns baseEquity when glidepath not requested', () => {
      expect(getEffectiveStartEquity(0.6, 30, false)).toBe(0.6);
      expect(getEffectiveStartEquity(0.8, 15, false)).toBe(0.8);
    });

    it('returns baseEquity when CAPE >= 20 and glidepath requested', () => {
      expect(getEffectiveStartEquity(0.6, 20, true)).toBe(0.6);
      expect(getEffectiveStartEquity(0.6, 30, true)).toBe(0.6);
    });

    it('returns 1.0 when CAPE < 20 and glidepath requested', () => {
      // ERN: skip glidepath, go 100% equities in cheap markets
      expect(getEffectiveStartEquity(0.6, 19, true)).toBe(1.0);
      expect(getEffectiveStartEquity(0.6, 10, true)).toBe(1.0);
      expect(getEffectiveStartEquity(0.8, 15, true)).toBe(1.0);
    });
  });
});
