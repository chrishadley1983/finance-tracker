/**
 * Cockpit binding for the gilt-ladder sizing. The arithmetic lives in
 * plan/engine/ladder.mjs; this binds it to the repo's assumptions.
 */
import { ASSUMPTIONS, type GiltPrice } from './constants';
import * as engine from '../../plan/engine/ladder.mjs';

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
  amountPerYear: number;
  firstYear: number;
  lastYear: number;
  allocations: RungAllocation[];
  byGilt: Array<{
    epic: string;
    giltName: string;
    maturity: string;
    matYear: number;
    coupon: string;
    dirty: number;
    realYield: number;
    face: number;
    realAmount: number;
    estCost: number;
    coversYears: number[];
    notes: string[];
  }>;
  totals: { face: number; estCost: number; realAmount: number };
}

export function sizeByBudget(prices: GiltPrice[], budgetReal: number, opts: { firstYear?: number; lastYear?: number } = {}): number {
  return engine.sizeByBudget(prices, budgetReal, {
    firstYear: opts.firstYear ?? ASSUMPTIONS.ladder.firstYear,
    lastYear: opts.lastYear ?? ASSUMPTIONS.ladder.lastYear,
  });
}

export function buildLadder(
  prices: GiltPrice[],
  opts: { firstYear?: number; lastYear?: number; amountPerYear?: number; budgetReal?: number } = {}
): LadderPlan {
  return engine.buildLadder(ASSUMPTIONS, prices, opts) as LadderPlan;
}

export const couponSchedule = (plan: LadderPlan, fromYear: number): Record<number, number> => engine.couponSchedule(plan as never, fromYear);
