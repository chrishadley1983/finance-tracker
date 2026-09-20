/**
 * Gilt ladder sizing. Ports scripts/gilt-ladder.mjs (do not rewrite there
 * without mirroring here). Sizing counts redemption only — coupons along the
 * way are the top-up, not part of the rung. Default sizing is BY BUDGET
 * (LADDER.budgetReal): redemption per year = what the money buys at live prices.
 */

import { LADDER, type GiltPrice } from './constants';

export interface RungAllocation {
  targetYear: number;
  epic: string;
  giltName: string;
  maturity: string;
  dirty: number;
  realYield: number;
  indexRatio: number;
  realAmount: number; // today's-money target carried by this allocation
  face: number; // nominal to order
  estCost: number;
  note: string; // '' when the year has its own linker
}

export interface LadderPlan {
  allocations: RungAllocation[]; // one per (targetYear, gilt) pair
  byGilt: Array<{
    epic: string;
    giltName: string;
    maturity: string;
    dirty: number;
    realYield: number;
    face: number;
    estCost: number;
    coversYears: number[];
    notes: string[];
  }>;
  totals: { face: number; estCost: number };
}

function allocate(prices: GiltPrice[], year: number, amount: number): RungAllocation[] {
  const make = (g: GiltPrice, realAmount: number, note: string): RungAllocation => {
    const indexRatio = g.dirty / g.clean;
    const face = realAmount / indexRatio;
    return {
      targetYear: year,
      epic: g.epic,
      giltName: g.name,
      maturity: g.maturity,
      dirty: g.dirty,
      realYield: g.realYield,
      indexRatio,
      realAmount,
      face,
      estCost: (face / 100) * g.dirty,
      note,
    };
  };

  const exact = prices.filter((g) => g.matYear === year);
  if (exact.length) return [make(exact[exact.length - 1], amount, '')];

  const sorted = [...prices].sort((a, b) => a.matYear - b.matYear);
  const before = [...sorted].reverse().find((g) => g.matYear < year);
  const after = sorted.find((g) => g.matYear > year);
  if (before && after) {
    return [
      make(before, amount / 2, `no ${year} linker — half via ${before.matYear}`),
      make(after, amount / 2, `no ${year} linker — half via ${after.matYear}`),
    ];
  }
  const nearest = before || after;
  if (!nearest) return [];
  return [make(nearest, amount, `no ${year} linker — nearest is ${nearest.matYear}`)];
}

/**
 * Real cost of £1 of real redemption for a target year, given the gilt(s) that
 * cover it. For a linker, cost = face/100 × dirty and face = real/indexRatio,
 * so cost per £1 real = dirty/(100 × indexRatio) = clean/100 — the coupon
 * stream is what makes clean differ from the zero-coupon price.
 */
function costPerRealPound(prices: GiltPrice[], year: number): number {
  return allocate(prices, year, 1).reduce((s, a) => s + a.estCost, 0);
}

/**
 * Redemption per year that a real budget buys across the target years —
 * the Plan E sizing rule. Returns 0 when no gilt can be allocated.
 */
export function sizeByBudget(
  prices: GiltPrice[],
  budgetReal: number,
  opts: { firstYear?: number; lastYear?: number } = {}
): number {
  const firstYear = opts.firstYear ?? LADDER.firstYear;
  const lastYear = opts.lastYear ?? LADDER.lastYear;
  let costPerPoundAllYears = 0;
  for (let y = firstYear; y <= lastYear; y++) costPerPoundAllYears += costPerRealPound(prices, y);
  return costPerPoundAllYears > 0 ? budgetReal / costPerPoundAllYears : 0;
}

export function buildLadder(
  prices: GiltPrice[],
  opts: { firstYear?: number; lastYear?: number; amountPerYear?: number; budgetReal?: number } = {}
): LadderPlan {
  const firstYear = opts.firstYear ?? LADDER.firstYear;
  const lastYear = opts.lastYear ?? LADDER.lastYear;
  // Default: size by the committed budget (Plan E), never a fixed £/yr.
  const amount =
    opts.amountPerYear ?? sizeByBudget(prices, opts.budgetReal ?? LADDER.budgetReal, { firstYear, lastYear });

  const allocations: RungAllocation[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    allocations.push(...allocate(prices, y, amount));
  }

  const byGiltMap = new Map<string, LadderPlan['byGilt'][number]>();
  for (const a of allocations) {
    let e = byGiltMap.get(a.epic);
    if (!e) {
      e = {
        epic: a.epic,
        giltName: a.giltName,
        maturity: a.maturity,
        dirty: a.dirty,
        realYield: a.realYield,
        face: 0,
        estCost: 0,
        coversYears: [],
        notes: [],
      };
      byGiltMap.set(a.epic, e);
    }
    e.face += a.face;
    e.estCost += a.estCost;
    e.coversYears.push(a.targetYear);
    if (a.note) e.notes.push(a.note);
  }
  const byGilt = Array.from(byGiltMap.values());
  return {
    allocations,
    byGilt,
    totals: {
      face: byGilt.reduce((s, g) => s + g.face, 0),
      estCost: byGilt.reduce((s, g) => s + g.estCost, 0),
    },
  };
}
