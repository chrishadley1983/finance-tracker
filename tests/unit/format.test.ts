import { describe, it, expect } from 'vitest';
import {
  formatGBP,
  formatGBPCompact,
  formatPercent,
  MONTH_NAMES,
  MONTH_SHORT,
  formatDateGB,
  formatDateGBPadded,
} from '@/lib/format';

describe('formatGBP', () => {
  it('formats whole pounds by default', () => {
    expect(formatGBP(1234)).toBe('£1,234');
    expect(formatGBP(1234567)).toBe('£1,234,567');
  });

  it('rounds to whole pounds when pence is off', () => {
    expect(formatGBP(1234.5)).toBe('£1,235');
    expect(formatGBP(1234.49)).toBe('£1,234');
    expect(formatGBP(0.4)).toBe('£0');
  });

  it('formats zero', () => {
    expect(formatGBP(0)).toBe('£0');
    expect(formatGBP(0, { pence: true })).toBe('£0.00');
  });

  it('formats negative numbers with a leading minus', () => {
    expect(formatGBP(-1234)).toBe('-£1,234');
    expect(formatGBP(-1234.567, { pence: true })).toBe('-£1,234.57');
  });

  it('shows two decimal places when pence is on', () => {
    expect(formatGBP(1234.5, { pence: true })).toBe('£1,234.50');
    expect(formatGBP(9.999, { pence: true })).toBe('£10.00');
    expect(formatGBP(0.005, { pence: true })).toBe('£0.01');
  });

  it('matches the previous inline Intl formatters exactly', () => {
    const zero = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const pence = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
    for (const v of [0, -0, 1, -1, 0.5, -0.5, 2.5, 1234.5, -987654.321, 1e9]) {
      expect(formatGBP(v)).toBe(zero.format(v));
      expect(formatGBP(v, { pence: true })).toBe(pence.format(v));
    }
  });

  it('adds a plus sign for positive values when signed', () => {
    expect(formatGBP(250, { signed: true })).toBe('+£250');
    expect(formatGBP(-250, { signed: true })).toBe('-£250');
    expect(formatGBP(0, { signed: true })).toBe('£0');
    expect(formatGBP(12.3, { pence: true, signed: true })).toBe('+£12.30');
  });
});

describe('formatGBPCompact', () => {
  it('uses M with one decimal for millions', () => {
    expect(formatGBPCompact(1_000_000)).toBe('£1.0M');
    expect(formatGBPCompact(1_250_000)).toBe('£1.3M');
  });

  it('uses k with no decimals for thousands', () => {
    expect(formatGBPCompact(1000)).toBe('£1k');
    expect(formatGBPCompact(999_999)).toBe('£1000k');
    expect(formatGBPCompact(45_400)).toBe('£45k');
  });

  it('uses whole pounds below 1000, including zero and negatives', () => {
    expect(formatGBPCompact(0)).toBe('£0');
    expect(formatGBPCompact(999.4)).toBe('£999');
    expect(formatGBPCompact(-5000)).toBe('£-5000');
  });
});

describe('formatPercent', () => {
  it('defaults to two decimal places', () => {
    expect(formatPercent(4.256)).toBe('4.26%');
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('respects the digits argument', () => {
    expect(formatPercent(3.14159, 1)).toBe('3.1%');
    expect(formatPercent(3.6, 0)).toBe('4%');
  });

  it('formats negative values', () => {
    expect(formatPercent(-1.5)).toBe('-1.50%');
  });
});

describe('month name constants', () => {
  it('has twelve full month names starting with January', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('January');
    expect(MONTH_NAMES[11]).toBe('December');
  });

  it('has twelve three-letter month names matching the full names', () => {
    expect(MONTH_SHORT).toHaveLength(12);
    MONTH_SHORT.forEach((short, i) => {
      expect(short).toHaveLength(3);
      expect(MONTH_NAMES[i].startsWith(short)).toBe(true);
    });
  });
});

describe('date helpers', () => {
  it('formatDateGB renders d MMM yyyy', () => {
    expect(formatDateGB(new Date(2025, 2, 5))).toBe('5 Mar 2025');
    expect(formatDateGB(new Date(2024, 11, 25))).toBe('25 Dec 2024');
  });

  it('formatDateGBPadded renders dd MMM yyyy', () => {
    expect(formatDateGBPadded(new Date(2025, 2, 5))).toBe('05 Mar 2025');
    expect(formatDateGBPadded(new Date(2024, 11, 25))).toBe('25 Dec 2024');
  });
});
