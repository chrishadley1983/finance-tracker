// @ts-check
/**
 * Index-linked gilt ladder sizing. Pure; ladder years and budgets come from
 * the assumptions object `a`, prices from a gilt-price observation.
 *
 * Sizing counts redemption only — coupons along the way are the top-up, not
 * part of the rung. Default sizing is BY BUDGET (a.ladder.budgetReal):
 * redemption per year = what the money buys at the given prices.
 *
 * Linker arithmetic: face = real amount / index ratio; cost = face/100 × dirty;
 * index ratio ≈ dirty/clean, so the cost of £1 of real redemption is clean/100
 * (the coupon stream is what makes clean differ from the zero-coupon price).
 *
 * SPEC: plan/engine/SPEC.md §ladder.
 */

/**
 * @typedef {{ epic: string, name: string, coupon: string, maturity: string, matYear: number, clean: number, dirty: number, realYield: number }} GiltPrice
 * @typedef {{ targetYear: number, epic: string, giltName: string, maturity: string, dirty: number, realYield: number,
 *   indexRatio: number, realAmount: number, face: number, estCost: number, note: string }} RungAllocation
 */

/**
 * Allocate one target year: the gilt maturing that year, else 50/50 across the
 * nearest earlier and later maturities (real value is what matters, not the
 * calendar year the cash arrives).
 * @param {GiltPrice[]} prices @param {number} year @param {number} amount
 * @returns {RungAllocation[]}
 */
export function allocate(prices, year, amount) {
  const make = (/** @type {GiltPrice} */ g, /** @type {number} */ realAmount, /** @type {string} */ note) => {
    const indexRatio = g.dirty / g.clean;
    const face = realAmount / indexRatio;
    return { targetYear: year, epic: g.epic, giltName: g.name, maturity: g.maturity, dirty: g.dirty, realYield: g.realYield, indexRatio, realAmount, face, estCost: (face / 100) * g.dirty, note };
  };
  const exact = prices.filter((g) => g.matYear === year);
  if (exact.length) return [make(exact[exact.length - 1], amount, '')];
  const sorted = [...prices].sort((x, y) => x.matYear - y.matYear);
  const before = [...sorted].reverse().find((g) => g.matYear < year);
  const after = sorted.find((g) => g.matYear > year);
  if (before && after) {
    return [make(before, amount / 2, `no ${year} linker — half via ${before.matYear}`), make(after, amount / 2, `no ${year} linker — half via ${after.matYear}`)];
  }
  const nearest = before || after;
  if (!nearest) return [];
  return [make(nearest, amount, `no ${year} linker — nearest is ${nearest.matYear}`)];
}

/** Real cost of £1 of real redemption for a target year. @param {GiltPrice[]} prices @param {number} year */
export function costPerRealPound(prices, year) {
  return allocate(prices, year, 1).reduce((s, x) => s + x.estCost, 0);
}

/**
 * Redemption per year that a real budget buys across the target years — the
 * Plan E sizing rule. 0 when nothing can be allocated.
 * @param {GiltPrice[]} prices @param {number} budgetReal @param {{ firstYear: number, lastYear: number }} years
 */
export function sizeByBudget(prices, budgetReal, years) {
  let c = 0;
  for (let y = years.firstYear; y <= years.lastYear; y++) c += costPerRealPound(prices, y);
  return c > 0 ? budgetReal / c : 0;
}

/**
 * Build the ladder. By default sizes by a.ladder.budgetReal over
 * a.ladder.firstYear..lastYear; pass amountPerYear to force a fixed redemption.
 * @param {any} a @param {GiltPrice[]} prices
 * @param {{ firstYear?: number, lastYear?: number, amountPerYear?: number, budgetReal?: number }} [opts]
 */
export function buildLadder(a, prices, opts = {}) {
  const firstYear = opts.firstYear ?? a.ladder.firstYear;
  const lastYear = opts.lastYear ?? a.ladder.lastYear;
  const amount = opts.amountPerYear ?? sizeByBudget(prices, opts.budgetReal ?? a.ladder.budgetReal, { firstYear, lastYear });
  /** @type {RungAllocation[]} */
  const allocations = [];
  for (let y = firstYear; y <= lastYear; y++) allocations.push(...allocate(prices, y, amount));
  /** @type {Map<string, { epic: string, giltName: string, maturity: string, matYear: number, coupon: string, dirty: number, realYield: number, face: number, realAmount: number, estCost: number, coversYears: number[], notes: string[] }>} */
  const byGiltMap = new Map();
  for (const x of allocations) {
    let e = byGiltMap.get(x.epic);
    if (!e) {
      const g = /** @type {GiltPrice} */ (prices.find((p) => p.epic === x.epic));
      e = { epic: x.epic, giltName: x.giltName, maturity: x.maturity, matYear: g.matYear, coupon: g.coupon, dirty: x.dirty, realYield: x.realYield, face: 0, realAmount: 0, estCost: 0, coversYears: [], notes: [] };
      byGiltMap.set(x.epic, e);
    }
    e.face += x.face; e.realAmount += x.realAmount; e.estCost += x.estCost; e.coversYears.push(x.targetYear);
    if (x.note) e.notes.push(x.note);
  }
  const byGilt = Array.from(byGiltMap.values());
  return {
    amountPerYear: amount, firstYear, lastYear, allocations, byGilt,
    totals: { face: byGilt.reduce((s, g) => s + g.face, 0), estCost: byGilt.reduce((s, g) => s + g.estCost, 0), realAmount: byGilt.reduce((s, g) => s + g.realAmount, 0) },
  };
}

/**
 * Real coupon income per year while each gilt is outstanding — the top-up on
 * top of the redemptions (approximate: annual coupon rate × real amount held).
 * @param {ReturnType<typeof buildLadder>} plan @param {number} fromYear
 */
export function couponSchedule(plan, fromYear) {
  const rate = (/** @type {string} */ c) => Number(String(c).replace('%', '')) / 100;
  /** @type {Record<number, number>} */
  const out = {};
  for (let y = fromYear; y <= plan.lastYear; y++) {
    let c = 0;
    for (const g of plan.byGilt) if (g.matYear >= y) c += g.realAmount * rate(g.coupon);
    out[y] = c;
  }
  return out;
}

/**
 * Parser for dividenddata.co.uk's index-linked gilt table (pure string → rows).
 * @param {string} html
 * @returns {GiltPrice[]}
 */
export function parseGiltTable(html) {
  /** @type {Record<string, number>} */
  const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  /** @type {GiltPrice[]} */
  const gilts = [];
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const cells = Array.from(row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)).map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&pound;/g, '£').trim());
    if (cells.length < 8 || cells[0] === 'Ticker') continue;
    const [epic, name, coupon, maturity, , cleanStr, dirtyStr, yieldStr] = cells;
    const m = maturity.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (!m || !(m[2] in MONTHS)) continue;
    const clean = Number(cleanStr.replace(/[£,]/g, ''));
    const dirty = Number(dirtyStr.replace(/[£,]/g, ''));
    const realYield = Number(yieldStr.replace('%', ''));
    if (!epic || !isFinite(clean) || !isFinite(dirty) || clean <= 0 || dirty <= 0) continue;
    gilts.push({ epic, name, coupon, maturity, matYear: Number(m[3]), clean, dirty, realYield: isFinite(realYield) ? realYield : 0 });
  }
  return gilts.sort((x, y) => x.matYear - y.matYear);
}
