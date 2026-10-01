// @ts-check
/**
 * Listed shares held directly (1 Oct 2026): the Accenture employee shares. `valueEquities` is pure; `fetchQuote`
 * is the only network call (Yahoo Finance chart endpoint, no key; ~15-minute delay, last close out of hours).
 */

/**
 * @param {string} symbol  e.g. 'ACN' or 'GBPUSD=X'
 * @returns {Promise<{ symbol: string, price: number, currency: string, time: string }>}
 */
export async function fetchQuote(symbol) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const j = await res.json();
  const m = j?.chart?.result?.[0]?.meta;
  if (!m || !(m.regularMarketPrice > 0)) throw new Error(`${symbol}: no price in the response`);
  return { symbol, price: m.regularMarketPrice, currency: m.currency, time: new Date(m.regularMarketTime * 1000).toISOString() };
}

/**
 * @param {Record<string, Array<{ symbol: string, units: number, currency: string, fxSymbol?: string }>>} equities  by account
 * @param {Record<string, { price: number, time: string }>} quotes  by symbol (shares and FX pairs; FX = units of the
 *   share's currency per £1, e.g. GBPUSD=X 1.32)
 */
export function valueEquities(equities, quotes) {
  const missing = /** @type {string[]} */ ([]);
  const accounts = Object.entries(equities).map(([account, lines]) => {
    const rows = lines.map((l) => {
      const q = quotes[l.symbol];
      const fx = l.currency === 'GBP' ? { price: 1, time: '' } : l.fxSymbol ? quotes[l.fxSymbol] : undefined;
      if (!q) missing.push(l.symbol);
      if (!fx && l.fxSymbol) missing.push(l.fxSymbol);
      const price = q?.price ?? NaN, rate = fx?.price ?? NaN;
      return { symbol: l.symbol, units: l.units, currency: l.currency, price, fx: rate, value: (l.units * price) / rate, priceTime: q?.time ?? null };
    });
    return { account, rows, total: rows.reduce((s, r) => s + r.value, 0) };
  });
  return { accounts, missing };
}
