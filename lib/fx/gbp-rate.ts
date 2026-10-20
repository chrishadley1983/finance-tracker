/**
 * GBP conversion for foreign-currency bank transactions (e.g. the HSBC Global Money wallets, which
 * TrueLayer reports in ZAR / DKK / EUR). The ledger stores every amount in GBP, so non-GBP rows are
 * converted at import using the ECB reference rate for the transaction date (Frankfurter API, free,
 * no key; weekends/holidays resolve to the previous business day). This is an estimate: HSBC's own
 * rate differs slightly, so the original amount + currency are stored alongside.
 */

const FX_API = process.env.FX_API_URL || 'https://api.frankfurter.dev/v1';

/** Units of `currency` per 1 GBP, keyed `${date}|${currency}`. */
const cache = new Map<string, number>();

export class FxRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxRateError';
  }
}

/**
 * Units of `currency` per 1 GBP on `date` (YYYY-MM-DD). Throws FxRateError when no rate is available,
 * so callers can hold the transaction back rather than insert a wrong amount.
 */
export async function unitsPerGbp(currency: string, date: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  const ccy = currency.toUpperCase();
  if (ccy === 'GBP') return 1;
  const key = `${date}|${ccy}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const today = new Date().toISOString().slice(0, 10);
  const when = date >= today ? 'latest' : date;
  let rate: number | undefined;
  try {
    const res = await fetchImpl(`${FX_API}/${when}?base=GBP&symbols=${encodeURIComponent(ccy)}`);
    if (!res.ok) throw new FxRateError(`FX API ${res.status} for ${ccy} on ${date}`);
    const body = (await res.json()) as { rates?: Record<string, number> };
    rate = body.rates?.[ccy];
  } catch (e) {
    if (e instanceof FxRateError) throw e;
    throw new FxRateError(`FX lookup failed for ${ccy} on ${date}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new FxRateError(`No ECB rate for ${ccy} on ${date}`);
  cache.set(key, rate);
  return rate;
}

/** Convert a signed foreign amount to GBP (2dp). */
export function toGbp(amount: number, unitsPerGbpRate: number): number {
  return Math.round((amount / unitsPerGbpRate) * 100) / 100;
}

/** Test hook. */
export function clearFxCache(): void {
  cache.clear();
}
