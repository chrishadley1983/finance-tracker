import { describe, it, expect } from 'vitest';
import {
  getDataLength,
  getMonthlyReturn,
  getCape,
  getWeightedReturn,
  getStockReturn,
  getBondReturn,
  CAPE_START_INDEX,
} from '@/lib/fire/ern/data';

describe('ERN Data Module', () => {
  describe('getDataLength', () => {
    it('returns exactly 1861 monthly data points', () => {
      expect(getDataLength()).toBe(1861);
    });
  });

  describe('getMonthlyReturn', () => {
    it('returns correct first element', () => {
      expect(getMonthlyReturn(0)).toEqual([-118, -253, 0]);
    });

    it('returns correct last element', () => {
      expect(getMonthlyReturn(1860)).toEqual([-162, 61, 390]);
    });

    it('throws on out-of-range index', () => {
      expect(() => getMonthlyReturn(-1)).toThrow(RangeError);
      expect(() => getMonthlyReturn(1861)).toThrow(RangeError);
    });
  });

  describe('CAPE_START_INDEX', () => {
    it('is 119', () => {
      expect(CAPE_START_INDEX).toBe(119);
    });

    it('has zero CAPE before index 119', () => {
      for (let i = 0; i < 119; i++) {
        expect(getMonthlyReturn(i)[2]).toBe(0);
      }
    });

    it('has non-zero CAPE at index 119', () => {
      expect(getMonthlyReturn(119)[2]).toBeGreaterThan(0);
    });
  });

  describe('getCape', () => {
    it('returns 18.4 at index 119', () => {
      expect(getCape(119)).toBe(18.4);
    });

    it('returns 0 for pre-CAPE indices', () => {
      expect(getCape(0)).toBe(0);
    });

    it('returns correct CAPE for last data point', () => {
      expect(getCape(1860)).toBe(39.0);
    });
  });

  describe('getWeightedReturn', () => {
    it('calculates correct weighted return at 80% equity for index 0', () => {
      const result = getWeightedReturn(0, 0.8);
      const expected = 0.8 * (-118 / 10000) + 0.2 * (-253 / 10000);
      expect(result).toBeCloseTo(expected, 10);
      expect(result).toBeCloseTo(-0.0145, 4);
    });

    it('returns pure stock return at 100% equity', () => {
      const result = getWeightedReturn(0, 1.0);
      expect(result).toBeCloseTo(getStockReturn(0), 10);
    });

    it('returns pure bond return at 0% equity', () => {
      const result = getWeightedReturn(0, 0.0);
      expect(result).toBeCloseTo(getBondReturn(0), 10);
    });
  });

  describe('individual return accessors', () => {
    it('getStockReturn returns correct decimal', () => {
      expect(getStockReturn(0)).toBeCloseTo(-118 / 10000, 10);
    });

    it('getBondReturn returns correct decimal', () => {
      expect(getBondReturn(0)).toBeCloseTo(-253 / 10000, 10);
    });
  });

  describe('data integrity', () => {
    it('all entries are 3-element arrays', () => {
      const len = getDataLength();
      for (let i = 0; i < len; i++) {
        const entry = getMonthlyReturn(i);
        expect(entry).toHaveLength(3);
      }
    });

    it('CAPE values are non-negative', () => {
      const len = getDataLength();
      for (let i = 0; i < len; i++) {
        expect(getMonthlyReturn(i)[2]).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
