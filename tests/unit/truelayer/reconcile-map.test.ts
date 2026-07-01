import { describe, it, expect } from 'vitest';
import { mapTrueLayerTransaction } from '@/lib/truelayer/reconcile-map';
import type { TrueLayerTransaction } from '@/lib/truelayer/types';

function tx(partial: Partial<TrueLayerTransaction>): TrueLayerTransaction {
  return {
    transaction_id: 'tl-1',
    timestamp: '2026-01-10T14:32:00Z',
    description: 'TESCO STORES',
    amount: 12.5,
    currency: 'GBP',
    transaction_type: 'DEBIT',
    ...partial,
  };
}

describe('mapTrueLayerTransaction', () => {
  it('signs DEBIT negative and CREDIT positive by magnitude', () => {
    expect(mapTrueLayerTransaction(tx({ amount: 12.5, transaction_type: 'DEBIT' }))?.amount).toBe(-12.5);
    expect(mapTrueLayerTransaction(tx({ amount: 12.5, transaction_type: 'CREDIT' }))?.amount).toBe(12.5);
  });

  it('is robust to TrueLayer returning an already-negative amount', () => {
    expect(mapTrueLayerTransaction(tx({ amount: -12.5, transaction_type: 'DEBIT' }))?.amount).toBe(-12.5);
    expect(mapTrueLayerTransaction(tx({ amount: -12.5, transaction_type: 'CREDIT' }))?.amount).toBe(12.5);
  });

  it('extracts the date from the ISO timestamp', () => {
    expect(mapTrueLayerTransaction(tx({ timestamp: '2026-03-05T00:00:00Z' }))?.date).toBe('2026-03-05');
  });

  it('prefers description then merchant_name', () => {
    expect(mapTrueLayerTransaction(tx({ description: 'ACME', merchant_name: 'Ignored' }))?.description).toBe('ACME');
    expect(mapTrueLayerTransaction(tx({ description: '', merchant_name: 'Shop' }))?.description).toBe('Shop');
  });

  it('uses provider_transaction_id as the stable ref, falling back to transaction_id', () => {
    expect(
      mapTrueLayerTransaction(tx({ transaction_id: 't1', meta: { provider_transaction_id: 'p1' } }))?.entryReference,
    ).toBe('p1');
    expect(mapTrueLayerTransaction(tx({ transaction_id: 't1', meta: {} }))?.entryReference).toBe('t1');
  });

  it('marks all mapped transactions as booked', () => {
    expect(mapTrueLayerTransaction(tx({}))?.status).toBe('BOOK');
  });

  it('returns null when unusable (no timestamp or non-numeric amount)', () => {
    expect(mapTrueLayerTransaction(tx({ timestamp: '' }))).toBeNull();
    expect(mapTrueLayerTransaction(tx({ amount: NaN }))).toBeNull();
  });
});
