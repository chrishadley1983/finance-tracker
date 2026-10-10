/** Shares held directly (1 Oct 2026): units × price in the share's currency ÷ FX (currency per £1). */
import { describe, it, expect } from 'vitest';
import { valueEquities } from '../../../plan/inputs/equity-prices.mjs';
import { newestHoldings } from '../../../plan/inputs/holdings.mjs';

describe('equity holdings', () => {
  it('converts a USD holding to GBP', () => {
    const v = valueEquities({ 'Accenture Shares': [{ symbol: 'ACN', units: 14, currency: 'USD', fxSymbol: 'GBPUSD=X' }] }, { ACN: { price: 183.37, time: 't' }, 'GBPUSD=X': { price: 1.3237, time: 't' } });
    // 14 × 183.37 = 2,567.18; ÷ 1.3237 = 1,939.40 (hand arithmetic; Chris's 1 Oct figure £1,935.27)
    expect(v.accounts[0].total).toBeCloseTo(1939.40, 2);
    expect(v.missing).toEqual([]);
  });
  it('reports a missing quote', () => {
    const v = valueEquities({ X: [{ symbol: 'ZZZ', units: 1, currency: 'USD', fxSymbol: 'GBPUSD=X' }] }, {});
    expect(v.missing).toEqual(['ZZZ', 'GBPUSD=X']);
  });
  it('the holdings file records the 14 Accenture shares', () => {
    expect((newestHoldings()!.data as unknown as { equities: Record<string, Array<{ units: number }>> }).equities['Accenture Shares'][0].units).toBe(14);
  });
});
