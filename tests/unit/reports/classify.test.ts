import { describe, it, expect } from 'vitest';
import { classifyAmount } from '@/lib/reports/classify';

describe('classifyAmount — shared sign-aware report classification', () => {
  it('counts positive amounts in income categories as income', () => {
    expect(classifyAmount(900, true, false)).toEqual({ income: 900, expense: 0 });
  });

  it('counts negative amounts in non-income categories as expense', () => {
    expect(classifyAmount(-5715.1, false, false)).toEqual({ income: 0, expense: 5715.1 });
  });

  it('ignores a refund (credit) sitting in an expense category', () => {
    // The bug the trend chart had: abs() of this would have inflated spend.
    expect(classifyAmount(40, false, false)).toEqual({ income: 0, expense: 0 });
  });

  it('ignores a clawback (debit) in an income category rather than subtracting', () => {
    expect(classifyAmount(-100, true, false)).toEqual({ income: 0, expense: 0 });
  });

  it('treats uncategorised debits as expense (isIncome=false)', () => {
    expect(classifyAmount(-12.5, false, false)).toEqual({ income: 0, expense: 12.5 });
  });

  it('contributes nothing for excluded categories regardless of sign', () => {
    expect(classifyAmount(3000, true, true)).toEqual({ income: 0, expense: 0 });
    expect(classifyAmount(-3000, false, true)).toEqual({ income: 0, expense: 0 });
  });
});
