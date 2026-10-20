import { describe, it, expect } from 'vitest';
import { mapTrueLayerTransaction } from '@/lib/truelayer/reconcile-map';
import { convertForeignToGbp } from '@/lib/truelayer/fx-convert';
import { FxRateError, toGbp, unitsPerGbp, clearFxCache } from '@/lib/fx/gbp-rate';
import type { TrueLayerTransaction } from '@/lib/truelayer/types';

function tx(partial: Partial<TrueLayerTransaction>): TrueLayerTransaction {
  return {
    transaction_id: 'tl-1',
    timestamp: '2026-10-18T19:20:29Z',
    description: 'X',
    amount: 10,
    currency: 'GBP',
    transaction_type: 'DEBIT',
    ...partial,
  };
}

describe('foreign-currency conversion', () => {
  it('maps the bank currency onto the row (GBP when absent)', () => {
    expect(mapTrueLayerTransaction(tx({ currency: 'zar' }))?.currency).toBe('ZAR');
    expect(mapTrueLayerTransaction(tx({ currency: '' as string }))?.currency).toBe('GBP');
  });

  it('converts non-GBP rows to GBP and keeps the original amount', async () => {
    const rows = [
      mapTrueLayerTransaction(tx({ amount: 13038.98, currency: 'ZAR', transaction_type: 'CREDIT' }))!,
      mapTrueLayerTransaction(tx({ amount: -280.61, currency: 'DKK' }))!,
      mapTrueLayerTransaction(tx({ amount: 4.5, currency: 'GBP' }))!,
    ];
    const rates: Record<string, number> = { ZAR: 21.915, DKK: 8.858 };
    const { rows: out, pending } = await convertForeignToGbp(rows, async (c) => rates[c]);
    expect(pending).toBe(0);
    expect(out[0]).toMatchObject({ amount: 594.98, originalAmount: 13038.98, currency: 'ZAR' });
    expect(out[1]).toMatchObject({ amount: -31.68, originalAmount: -280.61, currency: 'DKK' });
    expect(out[2]).toMatchObject({ amount: -4.5, currency: 'GBP' });
    expect(out[2].originalAmount).toBeUndefined();
  });

  it('holds back a row whose rate is unavailable instead of storing the foreign amount', async () => {
    const rows = [mapTrueLayerTransaction(tx({ amount: -450, currency: 'ZAR' }))!];
    const { rows: out, pending } = await convertForeignToGbp(rows, async () => {
      throw new FxRateError('down');
    });
    expect(out).toHaveLength(0);
    expect(pending).toBe(1);
  });

  it('toGbp rounds to pence', () => {
    expect(toGbp(-450, 21.915)).toBe(-20.53);
  });

  it('unitsPerGbp reads the ECB rate, caches it, and treats GBP as 1', async () => {
    clearFxCache();
    let calls = 0;
    const fake = (async (url: string) => {
      calls++;
      expect(url).toContain('base=GBP');
      expect(url).toContain('symbols=ZAR');
      return { ok: true, json: async () => ({ rates: { ZAR: 21.9 } }) } as Response;
    }) as unknown as typeof fetch;
    expect(await unitsPerGbp('GBP', '2026-10-18', fake)).toBe(1);
    expect(await unitsPerGbp('ZAR', '2026-10-18', fake)).toBe(21.9);
    expect(await unitsPerGbp('zar', '2026-10-18', fake)).toBe(21.9);
    expect(calls).toBe(1);
  });

  it('unitsPerGbp throws FxRateError when the API fails', async () => {
    clearFxCache();
    const bad = (async () => ({ ok: false, status: 500 }) as Response) as unknown as typeof fetch;
    await expect(unitsPerGbp('ZAR', '2026-10-01', bad)).rejects.toBeInstanceOf(FxRateError);
  });
});
