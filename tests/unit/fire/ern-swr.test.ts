import { describe, it, expect } from 'vitest';
import { computeSWR } from '@/lib/fire/ern/swr';
import { getRawData } from '@/lib/fire/ern/data';

describe('ERN SWR Computation', () => {
  // Reference values generated from v4 HTML (no fees, matching v4 exactly)
  describe('matches v4 reference (no fees)', () => {
    it('SWR at index 119, 80% eq, 48yr, 50% preserve', () => {
      const swr = computeSWR(119, 0.8, 576, 0.5, false, 120, undefined, false);
      expect(swr).toBeCloseTo(5.6472, 2);
    });

    it('SWR at index 200', () => {
      const swr = computeSWR(200, 0.8, 576, 0.5, false, 120, undefined, false);
      expect(swr).toBeCloseTo(5.0593, 2);
    });

    it('SWR at index 500', () => {
      const swr = computeSWR(500, 0.8, 576, 0.5, false, 120, undefined, false);
      expect(swr).toBeCloseTo(3.9991, 2);
    });
  });

  describe('glidepath (no fees, v4 15yr ramp for reference match)', () => {
    it('SWR at index 119 with glidepath', () => {
      // v4 uses 180mo glidepath
      const swr = computeSWR(119, 0.8, 576, 0.5, true, 180, undefined, false);
      expect(swr).toBeCloseTo(5.9134, 2);
    });

    it('SWR at index 500 with glidepath', () => {
      const swr = computeSWR(500, 0.8, 576, 0.5, true, 180, undefined, false);
      expect(swr).toBeCloseTo(4.1737, 2);
    });
  });

  describe('capital preservation variants (no fees)', () => {
    it('F=0 (full depletion)', () => {
      const swr = computeSWR(119, 0.8, 576, 0, false, 120, undefined, false);
      expect(swr).toBeCloseTo(5.8125, 2);
    });

    it('F=0.25 (25% preserved)', () => {
      const swr = computeSWR(119, 0.8, 576, 0.25, false, 120, undefined, false);
      expect(swr).toBeCloseTo(5.7299, 2);
    });

    it('F=0.50 (50% preserved)', () => {
      const swr = computeSWR(119, 0.8, 576, 0.50, false, 120, undefined, false);
      expect(swr).toBeCloseTo(5.6472, 2);
    });

    it('higher preservation = lower SWR', () => {
      const swr0 = computeSWR(119, 0.8, 576, 0, false, 120, undefined, false)!;
      const swr25 = computeSWR(119, 0.8, 576, 0.25, false, 120, undefined, false)!;
      const swr50 = computeSWR(119, 0.8, 576, 0.50, false, 120, undefined, false)!;
      expect(swr0).toBeGreaterThan(swr25);
      expect(swr25).toBeGreaterThan(swr50);
    });
  });

  describe('fee drag impact', () => {
    it('fees reduce SWR', () => {
      const noFees = computeSWR(119, 0.8, 576, 0.5, false, 120, undefined, false)!;
      const withFees = computeSWR(119, 0.8, 576, 0.5, false, 120, undefined, true)!;
      expect(withFees).toBeLessThan(noFees);
    });

    it('fee impact is small (~0.02-0.04% over 48yr)', () => {
      const noFees = computeSWR(119, 0.8, 576, 0.5, false, 120, undefined, false)!;
      const withFees = computeSWR(119, 0.8, 576, 0.5, false, 120, undefined, true)!;
      const diff = noFees - withFees;
      expect(diff).toBeGreaterThan(0.01);
      expect(diff).toBeLessThan(0.10);
    });
  });

  describe('edge cases', () => {
    it('returns null when horizon exceeds data', () => {
      expect(computeSWR(1860, 0.8, 12, 0, false)).toBeNull();
    });

    it('returns null when start + horizon > data length', () => {
      expect(computeSWR(1800, 0.8, 720, 0, false)).toBeNull();
    });

    it('handles 100% equity', () => {
      const swr = computeSWR(119, 1.0, 576, 0.5, false);
      expect(swr).not.toBeNull();
      expect(swr).toBeGreaterThan(0);
    });

    it('handles 40% equity', () => {
      const swr = computeSWR(119, 0.4, 576, 0.5, false);
      expect(swr).not.toBeNull();
      expect(swr).toBeGreaterThan(0);
    });
  });
});
