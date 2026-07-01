import type { MappedEbTransaction } from '@/lib/enable-banking/reconcile';
import type { TrueLayerTransaction } from './types';

/**
 * Map a TrueLayer transaction into the reconcile engine's provider-agnostic
 * shape. Amounts are signed by transaction_type (DEBIT negative, CREDIT
 * positive) using the magnitude, so we're robust to TrueLayer's own sign
 * convention. Only booked transactions come from /transactions.
 */
export function mapTrueLayerTransaction(tx: TrueLayerTransaction): MappedEbTransaction | null {
  const date = tx.timestamp ? tx.timestamp.slice(0, 10) : undefined;
  const raw = Number(tx.amount);
  if (!date || !Number.isFinite(raw)) return null;
  const magnitude = Math.abs(raw);
  const amount = tx.transaction_type === 'DEBIT' ? -magnitude : magnitude;
  const description = (tx.description || tx.merchant_name || 'Unknown transaction').trim();
  return {
    date,
    amount,
    description,
    // provider_transaction_id is the most stable id; fall back to transaction_id.
    entryReference: tx.meta?.provider_transaction_id || tx.transaction_id || undefined,
    status: 'BOOK',
  };
}
