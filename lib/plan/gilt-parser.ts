/**
 * Parser for dividenddata.co.uk's index-linked gilt table.
 * Kept pure so it can be unit-tested against a saved HTML fixture (E1/F8).
 */

import type { GiltPrice } from './constants';

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export function parseGiltTable(html: string): GiltPrice[] {
  const gilts: GiltPrice[] = [];
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const cells = Array.from(row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)).map((m) =>
      m[1].replace(/<[^>]+>/g, '').replace(/&pound;/g, '£').trim()
    );
    if (cells.length < 8 || cells[0] === 'Ticker') continue;
    const [epic, name, coupon, maturity, , cleanStr, dirtyStr, yieldStr] = cells;
    const m = maturity.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (!m || !(m[2] in MONTHS)) continue;
    const clean = Number(cleanStr.replace(/[£,]/g, ''));
    const dirty = Number(dirtyStr.replace(/[£,]/g, ''));
    const realYield = Number(yieldStr.replace('%', ''));
    if (!epic || !isFinite(clean) || !isFinite(dirty) || clean <= 0 || dirty <= 0) continue;
    gilts.push({
      epic,
      name,
      coupon,
      maturity,
      matYear: Number(m[3]),
      clean,
      dirty,
      realYield: isFinite(realYield) ? realYield : 0,
    });
  }
  return gilts.sort((a, b) => a.matYear - b.matYear);
}
