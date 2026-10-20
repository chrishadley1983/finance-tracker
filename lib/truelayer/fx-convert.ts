import type { MappedBankTransaction } from '@/lib/bank-sync/reconcile';
import { FxRateError, prefetchRates, toGbp, unitsPerGbp } from '@/lib/fx/gbp-rate';

/**
 * The ledger is GBP-only. Convert non-GBP rows (Global Money wallets) to GBP at the ECB rate for the
 * transaction date, keeping the original amount. Rows whose rate can't be fetched are held back (not
 * inserted, so the next sync retries them) rather than stored with a foreign amount posing as pounds.
 */
export async function convertForeignToGbp(
  rows: MappedBankTransaction[],
  rateFn?: (currency: string, date: string) => Promise<number>,
): Promise<{ rows: MappedBankTransaction[]; pending: number; earliestHeld: string | null }> {
  const out: MappedBankTransaction[] = [];
  let pending = 0;
  let earliestHeld: string | null = null;
  if (!rateFn) {
    // One time-series call per foreign currency covers the whole window (no per-row round trips).
    const spans = new Map<string, { from: string; to: string }>();
    for (const t of rows) {
      const c = (t.currency || 'GBP').toUpperCase();
      if (c === 'GBP') continue;
      const s = spans.get(c);
      spans.set(c, s ? { from: t.date < s.from ? t.date : s.from, to: t.date > s.to ? t.date : s.to } : { from: t.date, to: t.date });
    }
    for (const c of Array.from(spans.keys())) {
      const s = spans.get(c)!;
      await prefetchRates(c, s.from, s.to);
    }
    rateFn = (c, d) => unitsPerGbp(c, d);
  }
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
      if (!earliestHeld || t.date < earliestHeld) earliestHeld = t.date;
    }
  }
  return { rows: out, pending, earliestHeld };
}
