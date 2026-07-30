import { NextResponse } from 'next/server';
import { parseGiltTable } from '@/lib/plan/gilt-parser';
import { FALLBACK_GILT_PRICES, type GiltPrice } from '@/lib/plan/constants';

export const dynamic = 'force-dynamic';

const SOURCE = 'https://www.dividenddata.co.uk/index-linked-gilts-prices-yields.py';
const TTL_MS = 10 * 60 * 1000; // criterion F8: ≥10-minute cache

interface Cache {
  at: number;
  gilts: GiltPrice[];
}
let cache: Cache | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ asOf: new Date(cache.at).toISOString(), stale: false, source: 'cache', gilts: cache.gilts });
  }

  try {
    const res = await fetch(SOURCE, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const gilts = parseGiltTable(await res.text());
    if (gilts.length < 5) throw new Error(`parsed only ${gilts.length} rows — layout change?`);
    cache = { at: now, gilts };
    return NextResponse.json({ asOf: new Date(now).toISOString(), stale: false, source: 'live', gilts });
  } catch (err) {
    console.error('gilt-prices fetch failed:', err);
    if (cache) {
      // Criterion E1: serve the last good data, flagged stale.
      return NextResponse.json({ asOf: new Date(cache.at).toISOString(), stale: true, source: 'stale-cache', gilts: cache.gilts });
    }
    return NextResponse.json({ asOf: '2026-07-29T13:00:00Z', stale: true, source: 'fallback', gilts: FALLBACK_GILT_PRICES });
  }
}
