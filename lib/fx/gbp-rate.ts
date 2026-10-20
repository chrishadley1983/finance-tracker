/**
 * GBP conversion for foreign-currency bank transactions (e.g. the HSBC Global Money wallets, which
 * TrueLayer reports in ZAR / DKK / EUR). The ledger stores every amount in GBP, so non-GBP rows are
 * converted at import using the ECB reference rate for the transaction date (Frankfurter API, free,
 * no key; weekends/holidays use the previous business day's rate). This is an estimate: HSBC's own
 * rate differs slightly, so the original amount + currency are stored alongside.
 */

const FX_API = process.env.FX_API_URL || 'https://api.frankfurter.dev/v1';
const FX_TIMEOUT_MS = 10_000;

/** Units of `currency` per 1 GBP, keyed `${date}|${currency}`. */
const cache = new Map<string, number>();

export class FxRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxRateError';
  }
}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(FX_TIMEOUT_MS) });
  } catch (e) {
    throw new FxRateError(`FX lookup failed (${url}): ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new FxRateError(`FX API ${res.status} (${url})`);
  try {
    return await res.json();
  } catch (e) {
    throw new FxRateError(`FX API bad response (${url}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

function addDays(d: string, n: number): string {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Fill the cache for every calendar day in [from, to] with one time-series call per currency, carrying
 * the last business day's rate over weekends/holidays. Best effort: failures are left to unitsPerGbp.
 */
export async function prefetchRates(
  currency: string,
  from: string,
  to: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const ccy = currency.toUpperCase();
  if (ccy === 'GBP' || from > to) return;
  // Start a week early so a range opening on a weekend/holiday has a prior business-day rate to carry.
  const start = addDays(from, -7);
  const today = new Date().toISOString().slice(0, 10);
  const end = to > today ? today : to;
  let body: { rates?: Record<string, Record<string, number>> };
  try {
    body = (await getJson(`${FX_API}/${start}..${end}?base=GBP&symbols=${encodeURIComponent(ccy)}`, fetchImpl)) as typeof body;
  } catch {
    return;
  }
  const byDate = body.rates ?? {};
  let last: number | undefined;
  for (let d = start; d <= to; d = addDays(d, 1)) {
    const r = byDate[d]?.[ccy];
    if (r && Number.isFinite(r) && r > 0) last = r;
    if (last && d >= from) cache.set(`${d}|${ccy}`, last);
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
  const body = (await getJson(`${FX_API}/${when}?base=GBP&symbols=${encodeURIComponent(ccy)}`, fetchImpl)) as {
    rates?: Record<string, number>;
  };
  const rate = body.rates?.[ccy];
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new FxRateError(`No ECB rate for ${ccy} on ${date}`);
  cache.set(key, rate);
  return rate;
}

/** Convert a signed foreign amount to GBP (2dp). */
export function toGbp(amount: number, unitsPerGbpRate: number): number {
  const v = Math.round((amount / unitsPerGbpRate) * 100) / 100;
  return v === 0 ? 0 : v; // no -0
}

/** Test hook. */
export function clearFxCache(): void {
  cache.clear();
}
