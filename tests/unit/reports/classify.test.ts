import { describe, it, expect } from 'vitest';
import { classifyAmount } from '@/lib/reports/classify';

describe('classifyAmount — shared sign-aware report classification', () => {
  it('counts positive amounts in income categories as income', () => {
    expect(classifyAmount(900, true, false)).toEqual({ income: 900, expense: 0 });
  });

  it('counts negative amounts in non-income categories as expense', () => {
    expect(classifyAmount(-5715.1, false, false)).toEqual({ income: 0, expense: 5715.1 });
  });

  it('NETS a refund (credit) in a known expense category — credit subtracts from spend', () => {
    // -50 spend + 40 refund in the same category should net to 10.
    expect(classifyAmount(-50, false, false)).toEqual({ income: 0, expense: 50 });
    expect(classifyAmount(40, false, false)).toEqual({ income: 0, expense: -40 });
  });

  it('ignores a clawback (debit) in an income category rather than subtracting', () => {
    expect(classifyAmount(-100, true, false)).toEqual({ income: 0, expense: 0 });
  });

  it('treats uncategorised debits as expense but ignores uncategorised credits', () => {
    expect(classifyAmount(-12.5, false, false, false)).toEqual({ income: 0, expense: 12.5 });
    // An unreviewed credit must NOT net (we cannot assume it is a refund).
    expect(classifyAmount(80, false, false, false)).toEqual({ income: 0, expense: 0 });
  });

  it('contributes nothing for excluded categories regardless of sign', () => {
    expect(classifyAmount(3000, true, true)).toEqual({ income: 0, expense: 0 });
    expect(classifyAmount(-3000, false, true)).toEqual({ income: 0, expense: 0 });
  });
});
