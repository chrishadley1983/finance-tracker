import type { MappedBankTransaction } from '@/lib/bank-sync/reconcile';
import { FxRateError, toGbp, unitsPerGbp } from '@/lib/fx/gbp-rate';

/**
 * The ledger is GBP-only. Convert non-GBP rows (Global Money wallets) to GBP at the ECB rate for the
 * transaction date, keeping the original amount. Rows whose rate can't be fetched are held back (not
 * inserted, so the next sync retries them) rather than stored with a foreign amount posing as pounds.
 */
export async function convertForeignToGbp(
  rows: MappedBankTransaction[],
  rateFn: (currency: string, date: string) => Promise<number> = (c, d) => unitsPerGbp(c, d),
): Promise<{ rows: MappedBankTransaction[]; pending: number }> {
  const out: MappedBankTransaction[] = [];
  let pending = 0;
  for (const t of rows) {
    const ccy = (t.currency || 'GBP').toUpperCase();
    if (ccy === 'GBP') {
      out.push(t);
      continue;
    }
    try {
      const rate = await rateFn(ccy, t.date);
      out.push({ ...t, currency: ccy, originalAmount: t.amount, amount: toGbp(t.amount, rate) });
    } catch (e) {
      if (!(e instanceof FxRateError)) throw e;
      pending++;
    }
  }
  return { rows: out, pending };
}
